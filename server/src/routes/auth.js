import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Clubs a user administers — used so the client knows which club(s) to
// show on their "My Club" dashboard without a separate round-trip.
async function getUserClubs(userId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.name
     FROM club_admins ca
     JOIN clubs c ON c.id = ca.club_id
     WHERE ca.user_id = $1
     ORDER BY c.name ASC`,
    [userId]
  );
  return rows;
}

router.post('/signup', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const name = String(req.body?.name ?? '').trim();
  const phone = String(req.body?.phone ?? '').trim();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  try {
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, phone, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING id, email, name, phone, role`,
      [email, passwordHash, name, phone || null]
    );
    const user = rows[0];
    // Brand new users can't administer any club yet — skip the lookup.
    res.status(201).json({ token: signToken(user), user: { ...user, clubs: [] } });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, name, phone, role FROM users WHERE email = $1',
      [String(email).trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { password_hash, ...safeUser } = user;
    const clubs = await getUserClubs(safeUser.id);
    res.json({ token: signToken(safeUser), user: { ...safeUser, clubs } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, phone, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'User no longer exists' });
    const clubs = await getUserClubs(rows[0].id);
    res.json({ user: { ...rows[0], clubs } });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
