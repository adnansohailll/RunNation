import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/users?search= — super_admin only. Matches name/email/phone.
// Returns each user plus the clubs they currently administer.
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
    const { rows: clubRows } = await pool.query(
      `SELECT ca.user_id, c.id, c.name
       FROM club_admins ca
       JOIN clubs c ON c.id = ca.club_id
       WHERE ca.user_id = ANY($1::int[])
       ORDER BY c.name ASC`,
      [userIds]
    );
    const clubsByUser = new Map();
    for (const row of clubRows) {
      const list = clubsByUser.get(row.user_id) || [];
      list.push({ id: row.id, name: row.name });
      clubsByUser.set(row.user_id, list);
    }

    res.json({
      users: users.map((u) => ({ ...u, clubs: clubsByUser.get(u.id) || [] })),
    });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
