import express from 'express';
import cors from 'cors';
import pool from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import clubsRoutes from './routes/clubs.js';
import { requireAuth, optionalAuth } from './middleware/auth.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clubs', clubsRoutes);

// GET /api/runs — return all rows from run_metadata
app.get('/api/runs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rm.*, c.name AS club_name, c.logo_url AS club_logo_url
       FROM run_metadata rm
       LEFT JOIN clubs c ON c.id = rm.club_id
       ORDER BY 1`
    );
    res.json({ columns: result.fields.map((f) => f.name), rows: result.rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runs/:id — return a single row from run_metadata
app.get('/api/runs/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid run id' });
  }
  try {
    const result = await pool.query(
      `SELECT rm.*, c.name AS club_name, c.logo_url AS club_logo_url
       FROM run_metadata rm
       LEFT JOIN clubs c ON c.id = rm.club_id
       WHERE rm.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json({ columns: result.fields.map((f) => f.name), row: result.rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// occurrence_date is cast to text here (rather than left as a DATE, which
// pg/JSON would round-trip through a UTC timestamp and can shift by a day
// off a non-UTC server clock) so the client always gets a plain YYYY-MM-DD.
const COMMENT_COLUMNS = `rc.id, rc.body, rc.created_at, to_char(rc.occurrence_date, 'YYYY-MM-DD') AS occurrence_date, rc.photo_urls, rc.voice_note_url, rc.voice_note_duration, rc.is_system, rc.parent_comment_id, u.id AS user_id, u.name AS user_name`;
const MAX_COMMENT_PHOTOS = 10;
const MAX_VOICE_NOTE_SECONDS = 130; // 2 min cap + rounding buffer
const COMMENT_JOIN = `FROM run_comments rc JOIN users u ON u.id = rc.user_id`;
const DEFAULT_COMMENTS_PAGE_SIZE = 50;
const MAX_COMMENTS_PAGE_SIZE = 100;
const REACTION_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Attaches { reactions: [{emoji, count}], myReaction } to each comment in
// place, for whichever comment ids are passed in (top-level + replies
// together, since reactions work the same on both).
async function attachReactions(comments, viewerId) {
  const ids = comments.map((c) => c.id);
  if (ids.length === 0) return;

  const { rows: counts } = await pool.query(
    'SELECT comment_id, emoji, COUNT(*)::int AS count FROM run_comment_reactions WHERE comment_id = ANY($1) GROUP BY comment_id, emoji',
    [ids]
  );
  const reactionsByComment = new Map();
  for (const row of counts) {
    if (!reactionsByComment.has(row.comment_id)) reactionsByComment.set(row.comment_id, []);
    reactionsByComment.get(row.comment_id).push({ emoji: row.emoji, count: row.count });
  }

  let myReactionByComment = new Map();
  if (viewerId) {
    const { rows: mine } = await pool.query(
      'SELECT comment_id, emoji FROM run_comment_reactions WHERE user_id = $1 AND comment_id = ANY($2)',
      [viewerId, ids]
    );
    myReactionByComment = new Map(mine.map((r) => [r.comment_id, r.emoji]));
  }

  for (const c of comments) {
    c.reactions = reactionsByComment.get(c.id) || [];
    c.myReaction = myReactionByComment.get(c.id) || null;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

function dateOnly(d) {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// The next calendar date (on or after `fromDate`) that falls on `weekday` —
// i.e. which run occurrence a moment in time "belongs to".
function ceilToWeekday(weekday, fromDate) {
  const targetIdx = WEEKDAY_INDEX[weekday];
  const base = dateOnly(fromDate);
  if (targetIdx === undefined) return toISODate(base);
  const diff = (targetIdx - base.getDay() + 7) % 7;
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff);
  return toISODate(next);
}

// Next calendar date (today or later) that falls on the given weekday.
function nextOccurrenceISO(weekday) {
  return ceilToWeekday(weekday, new Date());
}

// Hourly rows from 1hr before to 1hr after the run's start time (e.g. a 7:00
// AM start returns the 6:00 AM–8:00 AM window), restricted to the given date.
function hoursAroundStart(startTimes, hourlyRows, date) {
  const m = String(startTimes ?? '').match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  const startHour = m ? Number(m[1]) : 7;
  const from = Math.max(0, startHour - 1);
  const to = Math.min(23, startHour + 1);
  return hourlyRows.filter((row) => {
    if (!row.time.startsWith(date)) return false;
    const hour = Number(row.time.slice(11, 13));
    return hour >= from && hour <= to;
  });
}

// GET /api/runs/:id/weather — hourly forecast (or, once an occurrence has
// passed, the conditions captured at the time) around the run's start time,
// for the given ?date= occurrence (defaults to the next upcoming one).
//
// Past occurrences are served from run_weather_snapshots rather than the
// live API, which only covers a rolling recent window and would otherwise
// go blank once a date ages out of it. See run_weather_snapshots' comment
// in init-schema.js for how that cache gets populated.
app.get('/api/runs/:id/weather', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid run id' });

  const dateParam = req.query.date;
  if (dateParam !== undefined && !DATE_RE.test(String(dateParam))) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT weekday, start_times, latitude, longitude FROM run_metadata WHERE id = $1',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Run not found' });

    const run = rows[0];
    const date = dateParam || nextOccurrenceISO(run.weekday);
    const isPast = date < toISODate(dateOnly(new Date()));

    if (isPast) {
      const { rows: snapshotRows } = await pool.query(
        'SELECT hourly FROM run_weather_snapshots WHERE run_id = $1 AND occurrence_date = $2',
        [id, date]
      );
      if (snapshotRows.length > 0) {
        return res.json({
          available: true, recorded: true, date, weekday: run.weekday, startTime: run.start_times,
          hourly: snapshotRows[0].hourly,
        });
      }
    }

    if (run.latitude == null || run.longitude == null) {
      return res.json({ available: false, reason: 'This run has no saved location to fetch weather for.' });
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', run.latitude);
    url.searchParams.set('longitude', run.longitude);
    url.searchParams.set('hourly', 'temperature_2m,weathercode,precipitation_probability,windspeed_10m,winddirection_10m');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('windspeed_unit', 'mph');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('start_date', date);
    url.searchParams.set('end_date', date);

    // A date far enough in the past gets rejected by the forecast API
    // outright (non-2xx) rather than returning an empty hourly array. For an
    // occurrence with no snapshot saved earlier, that's the same "gone"
    // outcome as an empty result — treat both the same way below instead of
    // surfacing it as a hard failure.
    let hourly = [];
    const weatherRes = await fetch(url);
    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      const hourlyRows = (weatherData.hourly?.time || []).map((time, i) => ({
        time,
        temperature: weatherData.hourly.temperature_2m[i],
        weatherCode: weatherData.hourly.weathercode[i],
        precipitationProbability: weatherData.hourly.precipitation_probability[i],
        windSpeed: weatherData.hourly.windspeed_10m[i],
        windDirection: weatherData.hourly.winddirection_10m[i],
      }));
      hourly = hoursAroundStart(run.start_times, hourlyRows, date);
    } else if (!isPast) {
      throw new Error(`Weather service returned ${weatherRes.status}`);
    }

    // Nothing came back for this date. For a past occurrence with no
    // snapshot saved earlier, that means its weather is simply gone — say so
    // plainly rather than the generic "not available yet" message that's
    // meant for a forecast that just hasn't opened up yet.
    if (hourly.length === 0) {
      if (isPast) {
        return res.json({ available: false, reason: "This run's weather wasn't recorded before it passed." });
      }
      return res.json({ available: true, recorded: false, date, weekday: run.weekday, startTime: run.start_times, hourly });
    }

    // Write-through cache: once real hours come back, save them so this
    // occurrence's conditions are on hand once it's in the past.
    await pool.query(
      `INSERT INTO run_weather_snapshots (run_id, occurrence_date, hourly)
       VALUES ($1, $2, $3)
       ON CONFLICT (run_id, occurrence_date) DO UPDATE SET hourly = EXCLUDED.hourly, captured_at = now()`,
      [id, date, JSON.stringify(hourly)]
    );

    res.json({ available: true, recorded: isPast, date, weekday: run.weekday, startTime: run.start_times, hourly });
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch weather data' });
  }
});

const ATTENDANCE_STATUSES = new Set(['in', 'cant', 'interested']);
const MONTH_RE = /^\d{4}-\d{2}$/;

// GET /api/runs/:id/attendance-status?month=YYYY-MM — the logged-in user's
// attendance status ('in' | 'cant' | 'interested') for each occurrence date
// of this run that falls in the given month. Powers the small status dot
// under each date in the calendar. Logged-out callers get {} — there's
// nothing personal to show them.
app.get('/api/runs/:id/attendance-status', optionalAuth, async (req, res) => {
  // Re-requested right after every pick (see RunCalendar.jsx) — a conditional-GET
  // 304 against a stale ETag would make a just-saved pick look unsaved.
  res.set('Cache-Control', 'no-store');

  const runId = Number(req.params.id);
  if (!Number.isInteger(runId)) return res.status(400).json({ error: 'Invalid run id' });

  const month = String(req.query.month ?? '');
  if (!MONTH_RE.test(month)) {
    return res.status(400).json({ error: 'month must be in YYYY-MM format' });
  }

  if (!req.user) return res.json({});

  try {
    const { rows } = await pool.query(
      `SELECT to_char(occurrence_date, 'YYYY-MM-DD') AS date, status
       FROM run_attendance
       WHERE run_id = $1 AND user_id = $2 AND to_char(occurrence_date, 'YYYY-MM') = $3`,
      [runId, req.user.id, month]
    );

    const statusByDate = {};
    for (const row of rows) statusByDate[row.date] = row.status;
    res.json(statusByDate);
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runs/:id/attendance — set the logged-in user's status for the
// given occurrence date (body: { date, status }). Posting the same status
// that's already set clears it back to "no selection"; posting a different
// one switches to it. Only allowed for today/future occurrences.
app.post('/api/runs/:id/attendance', requireAuth, async (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId)) return res.status(400).json({ error: 'Invalid run id' });

  const dateParam = String(req.body?.date ?? '');
  if (!DATE_RE.test(dateParam)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }
  const status = String(req.body?.status ?? '');
  if (!ATTENDANCE_STATUSES.has(status)) {
    return res.status(400).json({ error: "status must be one of: 'in', 'cant', 'interested'" });
  }
  if (dateParam < toISODate(dateOnly(new Date()))) {
    return res.status(400).json({ error: 'Cannot change attendance for a past run' });
  }

  try {
    const { rows: runRows } = await pool.query('SELECT id FROM run_metadata WHERE id = $1', [runId]);
    if (runRows.length === 0) return res.status(404).json({ error: 'Run not found' });

    const { rows: existing } = await pool.query(
      'SELECT id, status FROM run_attendance WHERE run_id = $1 AND user_id = $2 AND occurrence_date = $3',
      [runId, req.user.id, dateParam]
    );

    let newStatus = status;
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO run_attendance (run_id, user_id, occurrence_date, status) VALUES ($1, $2, $3, $4)',
        [runId, req.user.id, dateParam, status]
      );
    } else if (existing[0].status === status) {
      await pool.query('DELETE FROM run_attendance WHERE id = $1', [existing[0].id]);
      newStatus = null;
    } else {
      await pool.query('UPDATE run_attendance SET status = $1 WHERE id = $2', [status, existing[0].id]);
    }

    res.json({ date: dateParam, status: newStatus });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runs/:id/attendance-summary?month=YYYY-MM — everyone who picked
// 'in' or 'interested' for any occurrence of this run in the given month,
// public (not tied to the viewer's own login). Grouped by date, and within
// each date by status, so the calendar's buddy-icon badge can show both
// "N going" and "M interested" (with name lists) in one request per visible
// month instead of one per date.
app.get('/api/runs/:id/attendance-summary', async (req, res) => {
  // This gets re-requested right after every attendance pick so the badge
  // stays accurate — a conditional-GET 304 against a stale ETag would make
  // a just-saved pick look like it never happened.
  res.set('Cache-Control', 'no-store');

  const runId = Number(req.params.id);
  if (!Number.isInteger(runId)) return res.status(400).json({ error: 'Invalid run id' });

  const month = String(req.query.month ?? '');
  if (!MONTH_RE.test(month)) {
    return res.status(400).json({ error: 'month must be in YYYY-MM format' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT to_char(ra.occurrence_date, 'YYYY-MM-DD') AS date, ra.status, u.id, u.name
       FROM run_attendance ra
       JOIN users u ON u.id = ra.user_id
       WHERE ra.run_id = $1 AND ra.status IN ('in', 'interested') AND to_char(ra.occurrence_date, 'YYYY-MM') = $2
       ORDER BY u.name`,
      [runId, month]
    );

    const byDate = {};
    for (const row of rows) {
      const entry = (byDate[row.date] ??= { in: [], interested: [] });
      entry[row.status].push({ id: row.id, name: row.name });
    }
    res.json(byDate);
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runs/:id/comments — anyone can view a run's comments, newest
// first and paginated (?limit=, ?offset=, default 50/page). Pagination only
// counts top-level comments; each one carries its whole reply subtree,
// nested to any depth, as a `replies` array on each node (unpaginated — a
// single thread is expected to stay small) plus reaction summaries
// throughout. If a valid token is present, each comment also reports the
// viewer's own reaction.
// No ?date= → every comment for this run (the single discussion page).
// With ?date= → just that occurrence's comments, for the date filter.
app.get('/api/runs/:id/comments', optionalAuth, async (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId)) return res.status(400).json({ error: 'Invalid run id' });

  const dateParam = req.query.date;
  if (dateParam !== undefined && !DATE_RE.test(String(dateParam))) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_COMMENTS_PAGE_SIZE, 1), MAX_COMMENTS_PAGE_SIZE);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    // Fetch one extra row to know whether there's another page, without a
    // separate COUNT(*) query.
    const { rows } = await pool.query(
      dateParam
        ? `SELECT ${COMMENT_COLUMNS} ${COMMENT_JOIN} WHERE rc.run_id = $1 AND rc.occurrence_date = $2 AND rc.parent_comment_id IS NULL ORDER BY rc.created_at DESC LIMIT $3 OFFSET $4`
        : `SELECT ${COMMENT_COLUMNS} ${COMMENT_JOIN} WHERE rc.run_id = $1 AND rc.parent_comment_id IS NULL ORDER BY rc.created_at DESC LIMIT $2 OFFSET $3`,
      dateParam ? [runId, dateParam, limit + 1, offset] : [runId, limit + 1, offset]
    );
    const comments = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    // Replies can nest to any depth now, so walk the whole subtree under each
    // top-level comment on this page (not just its direct children) via a
    // recursive CTE, then reassemble it into a tree below.
    const topLevelIds = comments.map((c) => c.id);
    const { rows: replies } = topLevelIds.length
      ? await pool.query(
          `WITH RECURSIVE thread AS (
             SELECT id FROM run_comments WHERE parent_comment_id = ANY($1)
             UNION ALL
             SELECT rc.id FROM run_comments rc JOIN thread t ON rc.parent_comment_id = t.id
           )
           SELECT ${COMMENT_COLUMNS} ${COMMENT_JOIN} WHERE rc.id IN (SELECT id FROM thread) ORDER BY rc.created_at ASC`,
          [topLevelIds]
        )
      : { rows: [] };

    await attachReactions([...comments, ...replies], req.user?.id);

    const repliesByParent = new Map();
    for (const r of replies) {
      if (!repliesByParent.has(r.parent_comment_id)) repliesByParent.set(r.parent_comment_id, []);
      repliesByParent.get(r.parent_comment_id).push(r);
    }
    const attachReplies = (node) => {
      node.replies = repliesByParent.get(node.id) || [];
      node.replies.forEach(attachReplies);
    };
    comments.forEach(attachReplies);

    res.json({ comments, hasMore });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runs/:id/comments — any logged-in user can comment
app.post('/api/runs/:id/comments', requireAuth, async (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId)) return res.status(400).json({ error: 'Invalid run id' });
  const body = String(req.body?.body ?? '').trim();

  const photoUrls = Array.isArray(req.body?.photo_urls) ? req.body.photo_urls : [];
  if (photoUrls.length > MAX_COMMENT_PHOTOS) {
    return res.status(400).json({ error: `A comment can have at most ${MAX_COMMENT_PHOTOS} photos` });
  }
  if (!photoUrls.every((url) => typeof url === 'string' && url.startsWith('https://res.cloudinary.com/'))) {
    return res.status(400).json({ error: 'Invalid photo URL' });
  }

  const voiceNoteUrl = req.body?.voice_note_url ?? null;
  const voiceNoteDuration = req.body?.voice_note_duration ?? null;
  if (voiceNoteUrl !== null) {
    if (typeof voiceNoteUrl !== 'string' || !voiceNoteUrl.startsWith('https://res.cloudinary.com/')) {
      return res.status(400).json({ error: 'Invalid voice note URL' });
    }
    if (typeof voiceNoteDuration !== 'number' || !Number.isFinite(voiceNoteDuration) || voiceNoteDuration <= 0 || voiceNoteDuration > MAX_VOICE_NOTE_SECONDS) {
      return res.status(400).json({ error: 'Invalid voice note duration' });
    }
  }

  if (!body && photoUrls.length === 0 && !voiceNoteUrl) {
    return res.status(400).json({ error: 'Comment cannot be empty' });
  }

  const rawParentId = req.body?.parent_comment_id;
  let parentId = null;
  if (rawParentId != null) {
    parentId = Number(rawParentId);
    if (!Number.isInteger(parentId)) return res.status(400).json({ error: 'Invalid parent_comment_id' });
  }

  // occurrence_date: optional — used by the calendar's per-date attendance
  // comment prompt to pin the comment to whichever date the poster was
  // actually setting their status for. Omitted (the main composer at the
  // bottom of the page) falls back to auto-bucketing below.
  const rawOccurrenceDate = req.body?.occurrence_date;
  if (rawOccurrenceDate !== undefined && !DATE_RE.test(String(rawOccurrenceDate))) {
    return res.status(400).json({ error: 'occurrence_date must be in YYYY-MM-DD format' });
  }
  if (rawOccurrenceDate !== undefined && String(rawOccurrenceDate) < toISODate(dateOnly(new Date()))) {
    return res.status(400).json({ error: 'occurrence_date cannot be in the past' });
  }

  try {
    const { rows: runRows } = await pool.query('SELECT id, weekday FROM run_metadata WHERE id = $1', [runId]);
    if (runRows.length === 0) return res.status(404).json({ error: 'Run not found' });

    if (parentId !== null) {
      const { rows: parentRows } = await pool.query(
        'SELECT id, run_id FROM run_comments WHERE id = $1',
        [parentId]
      );
      if (parentRows.length === 0 || parentRows[0].run_id !== runId) {
        return res.status(400).json({ error: 'Parent comment not found for this run' });
      }
      // parentId is used as-is — replies nest under whichever comment (top-level
      // or reply) the poster actually replied to, to any depth.
    }

    // Which run occurrence this comment belongs to is normally never chosen
    // by the poster — it's always the next occurrence on/after the moment
    // they post — unless occurrence_date was given explicitly.
    const occurrenceDate = rawOccurrenceDate ? String(rawOccurrenceDate) : ceilToWeekday(runRows[0].weekday, new Date());

    const { rows: inserted } = await pool.query(
      'INSERT INTO run_comments (run_id, user_id, body, occurrence_date, photo_urls, voice_note_url, voice_note_duration, parent_comment_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [runId, req.user.id, body, occurrenceDate, photoUrls, voiceNoteUrl, voiceNoteUrl ? Math.round(voiceNoteDuration) : null, parentId]
    );
    const { rows } = await pool.query(
      `SELECT ${COMMENT_COLUMNS} ${COMMENT_JOIN} WHERE rc.id = $1`,
      [inserted[0].id]
    );
    const comment = rows[0];
    comment.reactions = [];
    comment.myReaction = null;
    comment.replies = []; // a reply can itself be replied to, so it needs this too
    res.status(201).json({ comment });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/runs/:id/comments/:commentId — comment author or super admin
app.delete('/api/runs/:id/comments/:commentId', requireAuth, async (req, res) => {
  const commentId = Number(req.params.commentId);
  if (!Number.isInteger(commentId)) return res.status(400).json({ error: 'Invalid comment id' });

  try {
    const { rows } = await pool.query('SELECT user_id FROM run_comments WHERE id = $1', [commentId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    await pool.query('DELETE FROM run_comments WHERE id = $1', [commentId]);
    res.status(204).end();
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runs/:id/comments/:commentId/reactions — toggle the logged-in
// user's emoji reaction on a comment or reply (body: { emoji }, one of
// REACTION_EMOJI). Posting the same emoji again removes it; a different
// emoji replaces it. Returns the comment's updated reaction summary.
app.post('/api/runs/:id/comments/:commentId/reactions', requireAuth, async (req, res) => {
  const runId = Number(req.params.id);
  const commentId = Number(req.params.commentId);
  if (!Number.isInteger(runId) || !Number.isInteger(commentId)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const emoji = String(req.body?.emoji ?? '');
  if (!REACTION_EMOJI.includes(emoji)) {
    return res.status(400).json({ error: 'Unsupported emoji' });
  }

  try {
    const { rows: commentRows } = await pool.query(
      'SELECT id FROM run_comments WHERE id = $1 AND run_id = $2',
      [commentId, runId]
    );
    if (commentRows.length === 0) return res.status(404).json({ error: 'Comment not found' });

    const { rows: existing } = await pool.query(
      'SELECT id, emoji FROM run_comment_reactions WHERE comment_id = $1 AND user_id = $2',
      [commentId, req.user.id]
    );

    if (existing.length > 0 && existing[0].emoji === emoji) {
      await pool.query('DELETE FROM run_comment_reactions WHERE id = $1', [existing[0].id]);
    } else if (existing.length > 0) {
      await pool.query('UPDATE run_comment_reactions SET emoji = $1, created_at = now() WHERE id = $2', [emoji, existing[0].id]);
    } else {
      await pool.query(
        'INSERT INTO run_comment_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3)',
        [commentId, req.user.id, emoji]
      );
    }

    const { rows: reactionRows } = await pool.query(
      'SELECT emoji, COUNT(*)::int AS count FROM run_comment_reactions WHERE comment_id = $1 GROUP BY emoji',
      [commentId]
    );
    const { rows: myRows } = await pool.query(
      'SELECT emoji FROM run_comment_reactions WHERE comment_id = $1 AND user_id = $2',
      [commentId, req.user.id]
    );

    res.json({ commentId, reactions: reactionRows, myReaction: myRows[0]?.emoji ?? null });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
