import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

// Unlisted "data entry" endpoints: any logged-in user (any role) can stage
// a run group or run here. Nothing here writes to the live run_groups /
// run_metadata tables — a person moves the staged rows over by hand later.

const router = Router();

const RUN_GROUP_REQUIRED_FIELDS = ['name', 'description', 'location'];
const RUN_GROUP_OPTIONAL_FIELDS = ['contact_email', 'contact_phone', 'website', 'meetup_day', 'meetup_time', 'logo_url'];
const RUN_GROUP_ALL_FIELDS = [...RUN_GROUP_REQUIRED_FIELDS, ...RUN_GROUP_OPTIONAL_FIELDS];

const RUN_REQUIRED_FIELDS = ['weekday', 'meetup_location'];
const RUN_OPTIONAL_FIELDS = ['start_times', 'address_intersection', 'average_distance', 'terrain', 'pace_groups'];
const RUN_ALL_FIELDS = [...RUN_REQUIRED_FIELDS, ...RUN_OPTIONAL_FIELDS];
const RUN_FIELD_DEFAULTS = { pace_groups: 'All levels welcome' };
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// GET /api/data-entry/run-groups — list staged run groups (used to populate
// the data-entry run form's group picker; only groups added through the
// data-entry run-group form ever show up here).
router.get('/run-groups', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM run_groups_data_entry ORDER BY name ASC');
    res.json({ runGroups: rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/data-entry/run-groups — any logged-in user can stage a new run group
router.post('/run-groups', requireAuth, async (req, res) => {
  const missing = RUN_GROUP_REQUIRED_FIELDS.filter((f) => !String(req.body?.[f] ?? '').trim());
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const values = RUN_GROUP_ALL_FIELDS.map((f) => req.body[f] ?? null);
  try {
    const { rows } = await pool.query(
      `INSERT INTO run_groups_data_entry (${RUN_GROUP_ALL_FIELDS.join(', ')}, created_by)
       VALUES (${RUN_GROUP_ALL_FIELDS.map((_, i) => `$${i + 1}`).join(', ')}, $${RUN_GROUP_ALL_FIELDS.length + 1})
       RETURNING *`,
      [...values, req.user.id]
    );
    res.status(201).json({ runGroup: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/data-entry/runs — any logged-in user can stage a new run.
// run_group_id must reference a group already staged in run_groups_data_entry.
router.post('/runs', requireAuth, async (req, res) => {
  const runGroupId = Number(req.body?.run_group_id);
  if (!Number.isInteger(runGroupId)) return res.status(400).json({ error: 'A valid run_group_id is required' });

  const missing = RUN_REQUIRED_FIELDS.filter((f) => !String(req.body?.[f] ?? '').trim());
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const startTimes = String(req.body?.start_times ?? '').trim();
  if (startTimes && !TIME_24H_RE.test(startTimes)) {
    return res.status(400).json({ error: 'start_times must be in 24-hour HH:MM format' });
  }

  try {
    const { rows: groupRows } = await pool.query('SELECT id FROM run_groups_data_entry WHERE id = $1', [runGroupId]);
    if (groupRows.length === 0) return res.status(404).json({ error: 'Staged run group not found' });

    const values = RUN_ALL_FIELDS.map((f) => {
      const raw = String(req.body[f] ?? '').trim();
      return raw || RUN_FIELD_DEFAULTS[f] || null;
    });
    const { rows } = await pool.query(
      `INSERT INTO run_metadata_data_entry (${RUN_ALL_FIELDS.join(', ')}, run_group_id, created_by)
       VALUES (${RUN_ALL_FIELDS.map((_, i) => `$${i + 1}`).join(', ')}, $${RUN_ALL_FIELDS.length + 1}, $${RUN_ALL_FIELDS.length + 2})
       RETURNING *`,
      [...values, runGroupId, req.user.id]
    );
    res.status(201).json({ run: rows[0] });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
