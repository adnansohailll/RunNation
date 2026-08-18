import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { sendActivationEmail } from '../email.js';

const router = Router();
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mirrors the `pattern` on the client's signup password field — requires an
// uppercase letter, a digit, and a special (non-alphanumeric) character.
const STRONG_PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/;
const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// The raw token goes in the email link; only its hash is ever stored, so a
// database read alone can't be used to activate someone else's account.
function hashActivationToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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
  if (password.length < MIN_PASSWORD_LENGTH || !STRONG_PASSWORD_RE.test(password)) {
    return res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include an uppercase letter, a number, and a special character`,
    });
  }

  try {
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const activationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, phone, role, email_verified, activation_token, activation_token_expires_at)
       VALUES ($1, $2, $3, $4, 'user', false, $5, $6)
       RETURNING id, email, name`,
      [email, passwordHash, name, phone || null, hashActivationToken(activationToken), expiresAt]
    );
    const user = rows[0];
    await sendActivationEmail({ to: user.email, name: user.name, token: activationToken });

    // No session yet — the account can't log in until the activation link
    // is clicked, so there's nothing to sign a token for.
    res.status(201).json({
      message: "Account created — check your email to activate it before logging in.",
      email: user.email,
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /activate — consumes the token from the activation email, marks the
// account verified, and logs the user in immediately (matches the login /
// signup response shape) since clicking the link proves email ownership.
router.post('/activate', async (req, res) => {
  const token = String(req.body?.token ?? '');
  if (!token) return res.status(400).json({ error: 'Activation token is required' });

  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET email_verified = true, activation_token = NULL, activation_token_expires_at = NULL
       WHERE activation_token = $1 AND activation_token_expires_at > now()
       RETURNING id, email, name, phone, role`,
      [hashActivationToken(token)]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'This activation link is invalid or has expired' });
    }
    const user = rows[0];
    const clubs = await getUserClubs(user.id);
    res.json({ token: signToken(user), user: { ...user, clubs } });
  } catch (err) {
    console.error('Activation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /resend-activation — issues a fresh token and re-sends the email.
// Always responds with the same generic message regardless of whether the
// address exists or is already verified, so this can't be used to probe
// which emails have accounts.
router.post('/resend-activation', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const genericMessage = "If that account exists and needs activation, we've sent a new link.";
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });

  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, email_verified FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user || user.email_verified) {
      return res.json({ message: genericMessage });
    }

    const activationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);
    await pool.query(
      'UPDATE users SET activation_token = $1, activation_token_expires_at = $2 WHERE id = $3',
      [hashActivationToken(activationToken), expiresAt, user.id]
    );
    await sendActivationEmail({ to: user.email, name: user.name, token: activationToken });
    res.json({ message: genericMessage });
  } catch (err) {
    console.error('Resend activation error:', err.message);
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
      'SELECT id, email, password_hash, name, phone, role, email_verified FROM users WHERE email = $1',
      [String(email).trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please activate your account before logging in — check your email for the link.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    const { password_hash, email_verified, ...safeUser } = user;
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
