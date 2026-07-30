import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendRunGroupAdminAssignedEmail } from '../email.js';

const router = Router();

const REQUIRED_FIELDS = ['name', 'description', 'location'];
const OPTIONAL_FIELDS = ['contact_email', 'contact_phone', 'website', 'meetup_day', 'meetup_time', 'logo_url'];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

function validateRunGroupFields(body) {
  const missing = REQUIRED_FIELDS.filter((f) => !String(body[f] ?? '').trim());
  if (missing.length > 0) {
    return `Missing required field(s): ${missing.join(', ')}`;
  }
  return null;
}

const ADMIN_SELECT = `
  SELECT u.id, u.email, u.name, u.phone
  FROM run_group_admins ra
  JOIN users u ON u.id = ra.user_id
  WHERE ra.run_group_id = $1
  ORDER BY u.name ASC
`;

const RUN_REQUIRED_FIELDS = ['weekday', 'meetup_location'];
const RUN_OPTIONAL_FIELDS = ['start_times', 'address_intersection', 'average_distance', 'terrain', 'pace_groups'];
const RUN_ALL_FIELDS = [...RUN_REQUIRED_FIELDS, ...RUN_OPTIONAL_FIELDS];
const RUN_FIELD_DEFAULTS = { pace_groups: 'All levels welcome' };
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Allows super admins through unconditionally; run group admins only if they
// administer the :id run group. Must run after requireAuth.
async function requireRunGroupAccess(req, res, next) {
  const runGroupId = Number(req.params.id);
  if (!Number.isInteger(runGroupId)) return res.status(400).json({ error: 'Invalid run group id' });
  if (req.user.role === 'super_admin') return next();
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Insufficient permissions' });

  try {
    const { rows } = await pool.query(
      'SELECT 1 FROM run_group_admins WHERE run_group_id = $1 AND user_id = $2',
      [runGroupId, req.user.id]
    );
    if (rows.length === 0) return res.status(403).json({ error: 'You are not an admin of this run group' });
    next();
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/run-groups — list run groups, optionally filtered by ?search= (name/location/description)
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const params = [];
    let sql = 'SELECT * FROM run_groups';
    if (search) {
      params.push(`%${search}%`);
      sql += ' WHERE name ILIKE $1 OR location ILIKE $1 OR description ILIKE $1';
    }
    sql += ' ORDER BY name ASC';
    const result = await pool.query(sql, params);
    res.json({ runGroups: result.rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/run-groups/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid run group id' });
  try {
    const { rows } = await pool.query('SELECT * FROM run_groups WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Run group not found' });
    res.json({ runGroup: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/run-groups — super admin only
router.post('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  const error = validateRunGroupFields(req.body || {});
  if (error) return res.status(400).json({ error });

  const values = ALL_FIELDS.map((f) => req.body[f] ?? null);
  try {
    const { rows } = await pool.query(
      `INSERT INTO run_groups (${ALL_FIELDS.join(', ')}, created_by)
       VALUES (${ALL_FIELDS.map((_, i) => `$${i + 1}`).join(', ')}, $${ALL_FIELDS.length + 1})
       RETURNING *`,
      [...values, req.user.id]
    );
    res.status(201).json({ runGroup: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/run-groups/:id — super admin only
router.put('/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid run group id' });

  const error = validateRunGroupFields(req.body || {});
  if (error) return res.status(400).json({ error });

  const values = ALL_FIELDS.map((f) => req.body[f] ?? null);
  try {
    const setClause = ALL_FIELDS.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE run_groups SET ${setClause}, updated_at = now() WHERE id = $${ALL_FIELDS.length + 1} RETURNING *`,
      [...values, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Run group not found' });
    res.json({ runGroup: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/run-groups/:id — super admin only
router.delete('/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid run group id' });
  try {
    const { rows } = await pool.query('DELETE FROM run_groups WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Run group not found' });
    res.status(204).end();
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/run-groups/:id/admins — list a run group's admins
router.get('/:id/admins', requireAuth, requireRole('super_admin'), async (req, res) => {
  const runGroupId = Number(req.params.id);
  if (!Number.isInteger(runGroupId)) return res.status(400).json({ error: 'Invalid run group id' });
  try {
    const { rows } = await pool.query(ADMIN_SELECT, [runGroupId]);
    res.json({ admins: rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/run-groups/:id/admins { userId } — super admin only. Assigns an
// existing user as an admin of this run group (many-to-many). Flips the
// user's role from 'user' to 'admin' if this is their first run group assignment.
router.post('/:id/admins', requireAuth, requireRole('super_admin'), async (req, res) => {
  const runGroupId = Number(req.params.id);
  const userId = Number(req.body?.userId);
  if (!Number.isInteger(runGroupId)) return res.status(400).json({ error: 'Invalid run group id' });
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'A valid userId is required' });

  try {
    const { rows: runGroupRows } = await pool.query('SELECT * FROM run_groups WHERE id = $1', [runGroupId]);
    if (runGroupRows.length === 0) return res.status(404).json({ error: 'Run group not found' });

    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'super_admin') {
      return res.status(400).json({ error: 'A super admin cannot be assigned as a run group admin' });
    }

    await pool.query(
      'INSERT INTO run_group_admins (run_group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [runGroupId, userId]
    );

    if (user.role === 'user') {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
    }

    if (user.email) {
      sendRunGroupAdminAssignedEmail({ to: user.email, name: user.name, runGroupName: runGroupRows[0].name }).catch(() => {});
    }

    const { rows: admins } = await pool.query(ADMIN_SELECT, [runGroupId]);
    res.status(201).json({ admins });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/run-groups/:id/admins/:userId — super admin only. Unassigns
// the user from this run group; if they have no other run group assignments
// left, their role reverts to 'user'.
router.delete('/:id/admins/:userId', requireAuth, requireRole('super_admin'), async (req, res) => {
  const runGroupId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (!Number.isInteger(runGroupId)) return res.status(400).json({ error: 'Invalid run group id' });
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });

  try {
    const { rows } = await pool.query(
      'DELETE FROM run_group_admins WHERE run_group_id = $1 AND user_id = $2 RETURNING *',
      [runGroupId, userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'This user is not an admin of this run group' });

    const { rows: remaining } = await pool.query(
      'SELECT 1 FROM run_group_admins WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (remaining.length === 0) {
      await pool.query("UPDATE users SET role = 'user' WHERE id = $1 AND role = 'admin'", [userId]);
    }

    const { rows: admins } = await pool.query(ADMIN_SELECT, [runGroupId]);
    res.json({ admins });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/run-groups/:id/stats — super admin, or an admin of this run group
router.get('/:id/stats', requireAuth, requireRunGroupAccess, async (req, res) => {
  const runGroupId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      'SELECT weekday, COUNT(*)::int AS count FROM run_metadata WHERE run_group_id = $1 GROUP BY weekday',
      [runGroupId]
    );
    const totalRuns = rows.reduce((sum, r) => sum + r.count, 0);
    res.json({ totalRuns, runsByDay: rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/run-groups/:id/runs — super admin, or an admin of this run group
router.get('/:id/runs', requireAuth, requireRunGroupAccess, async (req, res) => {
  const runGroupId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM run_metadata WHERE run_group_id = $1 ORDER BY id DESC',
      [runGroupId]
    );
    res.json({ runs: rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/run-groups/:id/runs — super admin, or an admin of this run group
router.post('/:id/runs', requireAuth, requireRunGroupAccess, async (req, res) => {
  const runGroupId = Number(req.params.id);
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
      `INSERT INTO run_metadata (${RUN_ALL_FIELDS.join(', ')}, run_group_id)
       VALUES (${RUN_ALL_FIELDS.map((_, i) => `$${i + 1}`).join(', ')}, $${RUN_ALL_FIELDS.length + 1})
       RETURNING *`,
      [...values, runGroupId]
    );
    res.status(201).json({ run: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
