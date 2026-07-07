// One-time (re-runnable) script: adds latitude/longitude columns to
// run_metadata if missing, then geocodes any row that doesn't have
// coordinates yet using the Google Geocoding API.
//
// Usage: node scripts/geocode-runs.js   (run from server/, needs .env loaded)
import 'dotenv/config';
import pool from '../src/db.js';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error('GOOGLE_MAPS_API_KEY is not set in server/.env');
  process.exit(1);
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results[0]) {
    throw new Error(`Geocoding failed for "${address}": ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`);
  }
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

async function main() {
  await pool.query(`
    ALTER TABLE run_metadata
      ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
  `);

  const { rows } = await pool.query(
    'SELECT id, meetup_location, address_intersection FROM run_metadata WHERE latitude IS NULL OR longitude IS NULL'
  );

  if (rows.length === 0) {
    console.log('All rows already have coordinates.');
    await pool.end();
    return;
  }

  console.log(`Geocoding ${rows.length} row(s)...`);

  for (const row of rows) {
    const address = [row.meetup_location, row.address_intersection].filter(Boolean).join(', ');
    try {
      const { lat, lng } = await geocode(address);
      await pool.query('UPDATE run_metadata SET latitude = $1, longitude = $2 WHERE id = $3', [lat, lng, row.id]);
      console.log(`  #${row.id} "${address}" -> ${lat}, ${lng}`);
    } catch (err) {
      console.error(`  #${row.id} "${address}" FAILED: ${err.message}`);
    }
    // Stay well under Google's rate limits for a small, infrequent batch job.
    await new Promise((r) => setTimeout(r, 200));
  }

  await pool.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
