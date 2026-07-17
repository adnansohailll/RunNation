import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendClubAdminAssignedEmail } from '../email.js';

const router = Router();

const REQUIRED_FIELDS = ['name', 'description', 'location'];
const OPTIONAL_FIELDS = ['contact_email', 'contact_phone', 'website', 'meetup_day', 'meetup_time', 'logo_url'];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

function validateClubFields(body) {
  const missing = REQUIRED_FIELDS.filter((f) => !String(body[f] ?? '').trim());
  if (missing.length > 0) {
    return `Missing required field(s): ${missing.join(', ')}`;
  }
  return null;
}

const ADMIN_SELECT = `
  SELECT u.id, u.email, u.name, u.phone
  FROM club_admins ca
  JOIN users u ON u.id = ca.user_id
  WHERE ca.club_id = $1
  ORDER BY u.name ASC
`;

const RUN_REQUIRED_FIELDS = ['weekday', 'meetup_location'];
const RUN_OPTIONAL_FIELDS = ['start_times', 'address_intersection', 'average_distance', 'terrain', 'pace_groups'];
const RUN_ALL_FIELDS = [...RUN_REQUIRED_FIELDS, ...RUN_OPTIONAL_FIELDS];
const RUN_FIELD_DEFAULTS = { pace_groups: 'All levels welcome' };
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Allows super admins through unconditionally; club admins only if they
// administer the :id club. Must run after requireAuth.
async function requireClubAccess(req, res, next) {
  const clubId = Number(req.params.id);
  if (!Number.isInteger(clubId)) return res.status(400).json({ error: 'Invalid club id' });
  if (req.user.role === 'super_admin') return next();
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Insufficient permissions' });

  try {
    const { rows } = await pool.query(
      'SELECT 1 FROM club_admins WHERE club_id = $1 AND user_id = $2',
      [clubId, req.user.id]
    );
    if (rows.length === 0) return res.status(403).json({ error: 'You are not an admin of this club' });
    next();
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/clubs — list clubs, optionally filtered by ?search= (name/location/description)
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const params = [];
    let sql = 'SELECT * FROM clubs';
    if (search) {
      params.push(`%${search}%`);
      sql += ' WHERE name ILIKE $1 OR location ILIKE $1 OR description ILIKE $1';
    }
    sql += ' ORDER BY name ASC';
    const result = await pool.query(sql, params);
    res.json({ clubs: result.rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clubs/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid club id' });
  try {
    const { rows } = await pool.query('SELECT * FROM clubs WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Club not found' });
    res.json({ club: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clubs — super admin only
router.post('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  const error = validateClubFields(req.body || {});
  if (error) return res.status(400).json({ error });

  const values = ALL_FIELDS.map((f) => req.body[f] ?? null);
  try {
    const { rows } = await pool.query(
      `INSERT INTO clubs (${ALL_FIELDS.join(', ')}, created_by)
       VALUES (${ALL_FIELDS.map((_, i) => `$${i + 1}`).join(', ')}, $${ALL_FIELDS.length + 1})
       RETURNING *`,
      [...values, req.user.id]
    );
    res.status(201).json({ club: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clubs/:id — super admin only
router.put('/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid club id' });

  const error = validateClubFields(req.body || {});
  if (error) return res.status(400).json({ error });

  const values = ALL_FIELDS.map((f) => req.body[f] ?? null);
  try {
    const setClause = ALL_FIELDS.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE clubs SET ${setClause}, updated_at = now() WHERE id = $${ALL_FIELDS.length + 1} RETURNING *`,
      [...values, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Club not found' });
    res.json({ club: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clubs/:id — super admin only
router.delete('/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid club id' });
  try {
    const { rows } = await pool.query('DELETE FROM clubs WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Club not found' });
    res.status(204).end();
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clubs/:id/admins — list a club's admins
router.get('/:id/admins', requireAuth, requireRole('super_admin'), async (req, res) => {
  const clubId = Number(req.params.id);
  if (!Number.isInteger(clubId)) return res.status(400).json({ error: 'Invalid club id' });
  try {
    const { rows } = await pool.query(ADMIN_SELECT, [clubId]);
    res.json({ admins: rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clubs/:id/admins { userId } — super admin only. Assigns an
// existing user as an admin of this club (many-to-many). Flips the user's
// role from 'user' to 'admin' if this is their first club assignment.
router.post('/:id/admins', requireAuth, requireRole('super_admin'), async (req, res) => {
  const clubId = Number(req.params.id);
  const userId = Number(req.body?.userId);
  if (!Number.isInteger(clubId)) return res.status(400).json({ error: 'Invalid club id' });
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'A valid userId is required' });

  try {
    const { rows: clubRows } = await pool.query('SELECT * FROM clubs WHERE id = $1', [clubId]);
    if (clubRows.length === 0) return res.status(404).json({ error: 'Club not found' });

    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'super_admin') {
      return res.status(400).json({ error: 'A super admin cannot be assigned as a club admin' });
    }

    await pool.query(
      'INSERT INTO club_admins (club_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [clubId, userId]
    );

    if (user.role === 'user') {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
    }

    if (user.email) {
      sendClubAdminAssignedEmail({ to: user.email, name: user.name, clubName: clubRows[0].name }).catch(() => {});
    }

    const { rows: admins } = await pool.query(ADMIN_SELECT, [clubId]);
    res.status(201).json({ admins });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clubs/:id/admins/:userId — super admin only. Unassigns the
// user from this club; if they have no other club assignments left, their
// role reverts to 'user'.
router.delete('/:id/admins/:userId', requireAuth, requireRole('super_admin'), async (req, res) => {
  const clubId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (!Number.isInteger(clubId)) return res.status(400).json({ error: 'Invalid club id' });
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });

  try {
    const { rows } = await pool.query(
      'DELETE FROM club_admins WHERE club_id = $1 AND user_id = $2 RETURNING *',
      [clubId, userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'This user is not an admin of this club' });

    const { rows: remaining } = await pool.query(
      'SELECT 1 FROM club_admins WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (remaining.length === 0) {
      await pool.query("UPDATE users SET role = 'user' WHERE id = $1 AND role = 'admin'", [userId]);
    }

    const { rows: admins } = await pool.query(ADMIN_SELECT, [clubId]);
    res.json({ admins });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clubs/:id/stats — super admin, or an admin of this club
router.get('/:id/stats', requireAuth, requireClubAccess, async (req, res) => {
  const clubId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      'SELECT weekday, COUNT(*)::int AS count FROM run_metadata WHERE club_id = $1 GROUP BY weekday',
      [clubId]
    );
    const totalRuns = rows.reduce((sum, r) => sum + r.count, 0);
    res.json({ totalRuns, runsByDay: rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clubs/:id/runs — super admin, or an admin of this club
router.get('/:id/runs', requireAuth, requireClubAccess, async (req, res) => {
  const clubId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM run_metadata WHERE club_id = $1 ORDER BY id DESC',
      [clubId]
    );
    res.json({ runs: rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clubs/:id/runs — super admin, or an admin of this club
router.post('/:id/runs', requireAuth, requireClubAccess, async (req, res) => {
  const clubId = Number(req.params.id);
  const missing = RUN_REQUIRED_FIELDS.filter((f) => !String(req.body?.[f] ?? '').trim());
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const startTimes = String(req.body?.start_times ?? '').trim();
  if (startTimes && !TIME_24H_RE.test(startTimes)) {
    return res.status(400).json({ error: 'start_times must be in 24-hour HH:MM format' });
  }

  const values = RUN_ALL_FIELDS.map((f) => {
    const raw = String(req.body[f] ?? '').trim();
    return raw || RUN_FIELD_DEFAULTS[f] || null;
  });
  try {
    const { rows } = await pool.query(
      `INSERT INTO run_metadata (${RUN_ALL_FIELDS.join(', ')}, club_id)
       VALUES (${RUN_ALL_FIELDS.map((_, i) => `$${i + 1}`).join(', ')}, $${RUN_ALL_FIELDS.length + 1})
       RETURNING *`,
      [...values, clubId]
    );
    res.status(201).json({ run: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
