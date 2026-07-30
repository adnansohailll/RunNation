import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/users?search= — super_admin only. Matches name/email/phone.
// Returns each user plus the run groups they currently administer.
router.get('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const params = [];
    let sql = 'SELECT id, email, name, phone, role, created_at FROM users';
    if (search) {
      params.push(`%${search}%`);
      sql += ' WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1';
    }
    sql += ' ORDER BY created_at DESC LIMIT 25';
    const { rows: users } = await pool.query(sql, params);

    if (users.length === 0) return res.json({ users: [] });

    const userIds = users.map((u) => u.id);
    const { rows: runGroupRows } = await pool.query(
      `SELECT ra.user_id, rg.id, rg.name
       FROM run_group_admins ra
       JOIN run_groups rg ON rg.id = ra.run_group_id
       WHERE ra.user_id = ANY($1::int[])
       ORDER BY rg.name ASC`,
      [userIds]
    );
    const runGroupsByUser = new Map();
    for (const row of runGroupRows) {
      const list = runGroupsByUser.get(row.user_id) || [];
      list.push({ id: row.id, name: row.name });
      runGroupsByUser.set(row.user_id, list);
    }

    res.json({
      users: users.map((u) => ({ ...u, runGroups: runGroupsByUser.get(u.id) || [] })),
    });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
