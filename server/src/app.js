import express from 'express';
import cors from 'cors';
import pool from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import clubsRoutes from './routes/clubs.js';
import { requireAuth } from './middleware/auth.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clubs', clubsRoutes);

// GET /api/runs — return all rows from run_metadata
app.get('/api/runs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM run_metadata ORDER BY 1');
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
    const result = await pool.query('SELECT * FROM run_metadata WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json({ columns: result.fields.map((f) => f.name), row: result.rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const COMMENT_COLUMNS = `rc.id, rc.body, rc.created_at, rc.occurrence_date, rc.photo_urls, rc.voice_note_url, rc.voice_note_duration, u.id AS user_id, u.name AS user_name`;
const MAX_COMMENT_PHOTOS = 10;
const MAX_VOICE_NOTE_SECONDS = 130; // 2 min cap + rounding buffer
const COMMENT_JOIN = `FROM run_comments rc JOIN users u ON u.id = rc.user_id`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

// Parses a "YYYY-MM-DD" string as a local calendar date (not UTC, unlike `new Date(str)`).
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateOnly(d) {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// GET /api/runs/:id/comments — anyone can view a run's comments.
// No ?date= → the main/general comment thread. With ?date= → that occurrence's thread.
app.get('/api/runs/:id/comments', async (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId)) return res.status(400).json({ error: 'Invalid run id' });

  const dateParam = req.query.date;
  if (dateParam !== undefined && !DATE_RE.test(String(dateParam))) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }

  try {
    const { rows } = await pool.query(
      dateParam
        ? `SELECT ${COMMENT_COLUMNS} ${COMMENT_JOIN} WHERE rc.run_id = $1 AND rc.occurrence_date = $2 ORDER BY rc.created_at ASC`
        : `SELECT ${COMMENT_COLUMNS} ${COMMENT_JOIN} WHERE rc.run_id = $1 AND rc.occurrence_date IS NULL ORDER BY rc.created_at ASC`,
      dateParam ? [runId, dateParam] : [runId]
    );
    res.json({ comments: rows });
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

  const occurrenceDate = req.body?.occurrence_date ?? null;
  if (occurrenceDate !== null && !DATE_RE.test(String(occurrenceDate))) {
    return res.status(400).json({ error: 'occurrence_date must be in YYYY-MM-DD format' });
  }

  try {
    const { rows: runRows } = await pool.query('SELECT id, weekday, created_at FROM run_metadata WHERE id = $1', [runId]);
    if (runRows.length === 0) return res.status(404).json({ error: 'Run not found' });

    if (occurrenceDate !== null) {
      const run = runRows[0];
      const date = parseLocalDate(occurrenceDate);
      const minDate = dateOnly(run.created_at);
      const maxDate = dateOnly(new Date());
      maxDate.setMonth(maxDate.getMonth() + 1);

      if (date.getDay() !== WEEKDAY_INDEX[run.weekday] || date < minDate || date > maxDate) {
        return res.status(400).json({ error: 'occurrence_date is not a valid date for this run' });
      }
    }

    const { rows: inserted } = await pool.query(
      'INSERT INTO run_comments (run_id, user_id, body, occurrence_date, photo_urls, voice_note_url, voice_note_duration) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [runId, req.user.id, body, occurrenceDate, photoUrls, voiceNoteUrl, voiceNoteUrl ? Math.round(voiceNoteDuration) : null]
    );
    const { rows } = await pool.query(
      `SELECT ${COMMENT_COLUMNS} ${COMMENT_JOIN} WHERE rc.id = $1`,
      [inserted[0].id]
    );
    res.status(201).json({ comment: rows[0] });
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
