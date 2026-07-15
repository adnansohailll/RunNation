// One-time (re-runnable) script: creates the users, clubs, and club_admins
// tables if they don't exist yet, then seeds the first super admin user
// from env vars.
//
// Usage: node scripts/init-schema.js   (run from server/, needs .env loaded)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../src/db.js';

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT,
      phone         TEXT,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clubs (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      description    TEXT NOT NULL,
      location       TEXT NOT NULL,
      contact_email  TEXT,
      contact_phone  TEXT,
      website        TEXT,
      meetup_day     TEXT,
      meetup_time    TEXT,
      logo_url       TEXT,
      created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS club_admins (
      club_id    INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (club_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_comments (
      id         SERIAL PRIMARY KEY,
      run_id     INTEGER NOT NULL REFERENCES run_metadata(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Heals installs left over from an earlier one-to-many (admin_id) /
  // invite-by-email design, in case those tables already existed.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`);
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS invite_token`);
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS invite_token_expires_at`);
  await pool.query(`ALTER TABLE clubs DROP COLUMN IF EXISTS admin_id`);
  await pool.query(`ALTER TABLE clubs ALTER COLUMN contact_email DROP NOT NULL`);

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set — skipping super admin seed.');
    await pool.end();
    return;
  }

  const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) {
    console.log(`Super admin "${email}" already exists — skipping.`);
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
    [email, passwordHash, process.env.SUPER_ADMIN_NAME || 'Super Admin', 'super_admin']
  );
  console.log(`Super admin "${email}" created.`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
