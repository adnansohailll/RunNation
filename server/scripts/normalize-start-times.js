// One-time (re-runnable) script: converts run_metadata.start_times from
// whatever free-text format it was entered in (e.g. "7 AM", "6:00pm") into
// 24-hour "HH:MM", now that the app only accepts/displays 24-hour time.
//
// Usage: node scripts/normalize-start-times.js   (run from server/, needs .env loaded)
import 'dotenv/config';
import pool from '../src/db.js';

const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_12H_RE = /^(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?[Mm]\.?$/;

function to24Hour(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (TIME_24H_RE.test(s)) return s; // already normalized

  const m = s.match(TIME_12H_RE);
  if (!m) return undefined; // unparseable — leave untouched, but flag it

  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const isPM = m[3].toUpperCase() === 'P';
  if (hour === 12) hour = 0;
  if (isPM) hour += 12;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

async function main() {
  const { rows } = await pool.query('SELECT id, start_times FROM run_metadata');

  let updated = 0;
  const unparseable = [];

  for (const row of rows) {
    const normalized = to24Hour(row.start_times);
    if (normalized === undefined) {
      if (row.start_times) unparseable.push({ id: row.id, start_times: row.start_times });
      continue;
    }
    if (normalized === row.start_times) continue;

    await pool.query('UPDATE run_metadata SET start_times = $1 WHERE id = $2', [normalized, row.id]);
    console.log(`#${row.id}: "${row.start_times}" -> "${normalized}"`);
    updated++;
  }

  console.log(`\nUpdated ${updated} row(s).`);
  if (unparseable.length > 0) {
    console.log(`Could not parse ${unparseable.length} row(s), left as-is:`, unparseable);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
