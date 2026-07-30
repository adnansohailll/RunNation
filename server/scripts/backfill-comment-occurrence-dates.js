// One-time (re-runnable) script: recomputes every comment's occurrence_date
// as the run's next weekday occurrence on/after the comment's created_at, so
// existing comments (posted under the old manual-date-picker system, or with
// no date at all) match the new auto-bucketing rule used by POST /comments.
//
// Usage: node scripts/backfill-comment-occurrence-dates.js   (run from server/, needs .env loaded)
import 'dotenv/config';
import pool from '../src/db.js';

const WEEKDAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

function dateOnly(d) {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ceilToWeekday(weekday, fromDate) {
  const targetIdx = WEEKDAY_INDEX[weekday];
  const base = dateOnly(fromDate);
  if (targetIdx === undefined) return toISODate(base);
  const diff = (targetIdx - base.getDay() + 7) % 7;
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff);
  return toISODate(next);
}

async function main() {
  const { rows } = await pool.query(`
    SELECT rc.id, rc.created_at, rc.occurrence_date, rm.weekday
    FROM run_comments rc
    JOIN run_metadata rm ON rm.id = rc.run_id
  `);

  if (rows.length === 0) {
    console.log('No comments to backfill.');
    await pool.end();
    return;
  }

  let changed = 0;
  for (const row of rows) {
    const occurrenceDate = ceilToWeekday(row.weekday, row.created_at);
    const before = row.occurrence_date ? toISODate(new Date(row.occurrence_date)) : null;
    if (before === occurrenceDate) continue;
    await pool.query('UPDATE run_comments SET occurrence_date = $1 WHERE id = $2', [occurrenceDate, row.id]);
    console.log(`  #${row.id} ${before ?? '(none)'} -> ${occurrenceDate}`);
    changed++;
  }

  console.log(`Backfilled ${changed} of ${rows.length} comment(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
