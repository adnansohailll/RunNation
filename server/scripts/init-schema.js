// One-time (re-runnable) script: creates the users, run_groups, and
// run_group_admins tables if they don't exist yet, then seeds the first
// super admin user from env vars.
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

  // Creates the new run_groups / run_group_admins tables (the "Club"
  // naming's replacements), copies over any data still sitting in the old
  // clubs / club_admins tables, backfills run_metadata's run_group_id from
  // its old club_id column, then drops the old tables/column entirely.
  // Safe to re-run: once the old tables are gone, the copy/drop steps
  // below become no-ops (guarded by information_schema checks).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_groups (
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
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clubs') THEN
        INSERT INTO run_groups (id, name, description, location, contact_email, contact_phone, website, meetup_day, meetup_time, logo_url, created_by, created_at, updated_at)
        SELECT id, name, description, location, contact_email, contact_phone, website, meetup_day, meetup_time, logo_url, created_by, created_at, updated_at
        FROM clubs
        ON CONFLICT (id) DO NOTHING;

        PERFORM setval(pg_get_serial_sequence('run_groups', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM run_groups), 1));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_group_admins (
      run_group_id INTEGER NOT NULL REFERENCES run_groups(id) ON DELETE CASCADE,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (run_group_id, user_id)
    )
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'club_admins') THEN
        INSERT INTO run_group_admins (run_group_id, user_id, created_at)
        SELECT club_id, user_id, created_at FROM club_admins
        ON CONFLICT (run_group_id, user_id) DO NOTHING;
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'run_metadata' AND column_name = 'club_id'
      ) THEN
        ALTER TABLE run_metadata ADD COLUMN IF NOT EXISTS run_group_id INTEGER REFERENCES run_groups(id);
        UPDATE run_metadata SET run_group_id = club_id WHERE run_group_id IS NULL;
        ALTER TABLE run_metadata DROP COLUMN club_id;
      END IF;
    END $$;
  `);

  // Old data is now fully copied over — drop the child table before the
  // parent so any leftover club_admins -> clubs foreign key doesn't block it.
  await pool.query(`DROP TABLE IF EXISTS club_admins`);
  await pool.query(`DROP TABLE IF EXISTS clubs`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_comments (
      id         SERIAL PRIMARY KEY,
      run_id     INTEGER NOT NULL REFERENCES run_metadata(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Staging tables for the unlisted "data entry" forms: any logged-in user
  // can submit a run group / run here without it going live. Someone
  // reviews and moves the rows into run_groups / run_metadata later by
  // hand — nothing here does that automatically. Column sets mirror the
  // real tables' user-editable fields so that later move is a plain
  // column-for-column INSERT ... SELECT.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_groups_data_entry (
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
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // run_group_id references run_groups_data_entry (not the live run_groups
  // table) on purpose: the data-entry run form can only pick a group that
  // was itself added through the data-entry run-group form.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_metadata_data_entry (
      id                   SERIAL PRIMARY KEY,
      run_group_id         INTEGER NOT NULL REFERENCES run_groups_data_entry(id) ON DELETE CASCADE,
      weekday              TEXT NOT NULL,
      start_times          TEXT,
      meetup_location      TEXT NOT NULL,
      address_intersection TEXT,
      average_distance     TEXT,
      terrain              TEXT,
      pace_groups          TEXT DEFAULT 'All levels welcome',
      created_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Heals installs left over from an earlier one-to-many (admin_id) /
  // invite-by-email design, in case those tables already existed.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`);
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS invite_token`);
  await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS invite_token_expires_at`);
  await pool.query(`ALTER TABLE run_groups DROP COLUMN IF EXISTS admin_id`);
  await pool.query(`ALTER TABLE run_groups ALTER COLUMN contact_email DROP NOT NULL`);

  // run_metadata.created_at: added later so existing rows can be told apart
  // from newly-added ones; backfilled to now() for any pre-existing rows.
  await pool.query(`ALTER TABLE run_metadata ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`);

  // run_comments.occurrence_date: which run occurrence a comment belongs to.
  // Set automatically at post time (next weekday occurrence on/after
  // created_at) — never chosen by the poster. Used to filter the single
  // discussion page down to one date's comments.
  await pool.query(`ALTER TABLE run_comments ADD COLUMN IF NOT EXISTS occurrence_date DATE`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_run_comments_run_occurrence ON run_comments (run_id, occurrence_date)`);

  // run_comments.photo_urls: Cloudinary URLs for photos attached to the
  // comment (uploaded client-side, direct to Cloudinary). Empty array means
  // a text-only comment.
  await pool.query(`ALTER TABLE run_comments ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}'`);

  // run_comments.voice_note_url/_duration: an optional recorded voice note
  // (also uploaded client-side, direct to Cloudinary). Duration (seconds) is
  // measured at record time so the player can show it before metadata loads.
  await pool.query(`ALTER TABLE run_comments ADD COLUMN IF NOT EXISTS voice_note_url TEXT`);
  await pool.query(`ALTER TABLE run_comments ADD COLUMN IF NOT EXISTS voice_note_duration INTEGER`);

  // run_metadata.pace_groups: default unset runs to "All levels welcome"
  // instead of a blank/"Not specified" value, and backfill existing rows.
  await pool.query(`ALTER TABLE run_metadata ALTER COLUMN pace_groups SET DEFAULT 'All levels welcome'`);
  await pool.query(`
    UPDATE run_metadata
    SET pace_groups = 'All levels welcome'
    WHERE pace_groups IS NULL OR TRIM(pace_groups) = '' OR pace_groups = 'Not specified'
  `);

  // run_attendance: one row per user who has picked a status ('in', 'cant',
  // 'interested') for a run occurrence. Picking the same status again removes
  // the row (a toggle back off to "no selection"); picking a different status
  // updates it in place. Only meaningful for today/future occurrences; the
  // API rejects writes for past dates, but old rows are kept so history stays
  // intact.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_attendance (
      id              SERIAL PRIMARY KEY,
      run_id          INTEGER NOT NULL REFERENCES run_metadata(id) ON DELETE CASCADE,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      occurrence_date DATE NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (run_id, user_id, occurrence_date)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_run_attendance_run_occurrence ON run_attendance (run_id, occurrence_date)`);

  // run_attendance.status: which of the three RSVP options the user picked.
  // Existing rows (from before this column existed) default to 'in', since
  // presence-of-row used to mean "I'm in" outright.
  await pool.query(`ALTER TABLE run_attendance ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in'`);
  await pool.query(`ALTER TABLE run_attendance DROP CONSTRAINT IF EXISTS run_attendance_status_check`);
  await pool.query(`
    ALTER TABLE run_attendance
    ADD CONSTRAINT run_attendance_status_check CHECK (status IN ('in', 'cant', 'interested'))
  `);

  // run_weather_snapshots: one row per (run, occurrence date) holding the
  // hourly conditions around that run's start time. Not merged into
  // run_attendance — that table is per-user (one row per RSVP), while
  // weather is a single fact about the occurrence itself, so it gets its
  // own table keyed the same way run_attendance is keyed, minus the user.
  // Written as a write-through cache by GET /api/runs/:id/weather: the live
  // Open-Meteo forecast only covers a rolling recent window, so the first
  // time anyone views a still-fetchable forecast for an occurrence (which
  // happens naturally, since that's also the default "next run" weather
  // view), its conditions are saved here — by the time the run is in the
  // past, its weather is already on hand instead of unavailable.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_weather_snapshots (
      run_id          INTEGER NOT NULL REFERENCES run_metadata(id) ON DELETE CASCADE,
      occurrence_date DATE NOT NULL,
      hourly          JSONB NOT NULL,
      captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (run_id, occurrence_date)
    )
  `);

  // run_comments.is_system: WhatsApp-style "X joined/left" info lines, posted
  // automatically when someone toggles their attendance. Rendered as a plain
  // centered line rather than a normal comment bubble — never authored by a
  // user directly, so there's no delete affordance for them either.
  await pool.query(`ALTER TABLE run_comments ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false`);

  // run_comments.parent_comment_id: replies, nested to any depth — NULL means
  // a top-level comment, set means a reply to whichever comment (top-level or
  // itself a reply) that id points to. ON DELETE CASCADE means deleting a
  // comment takes its whole reply subtree with it.
  await pool.query(`ALTER TABLE run_comments ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES run_comments(id) ON DELETE CASCADE`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_run_comments_parent ON run_comments (parent_comment_id)`);

  // run_comment_reactions: one emoji reaction per user per comment (covers
  // both top-level comments and replies — same table, no distinction
  // needed). Posting again with the same emoji removes it; a different
  // emoji replaces it — same toggle-or-replace behavior as Facebook
  // reactions, just plain emoji instead of custom icons.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_comment_reactions (
      id         SERIAL PRIMARY KEY,
      comment_id INTEGER NOT NULL REFERENCES run_comments(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (comment_id, user_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_run_comment_reactions_comment ON run_comment_reactions (comment_id)`);

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
