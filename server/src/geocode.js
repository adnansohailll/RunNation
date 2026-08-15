// Shared helper for turning a street address into lat/long via the Google
// Geocoding API. Used both when a run is created (routes/clubs.js) and by
// the one-off backfill script (scripts/geocode-runs.js).

// Returns { lat, lng } or null if geocoding can't be done (no API key, no
// address, lookup failed) — callers should treat this as "leave it unset"
// rather than a hard failure.
export async function geocodeAddress(address) {
  // Read lazily (not at module load) since dotenv.config() in index.js runs
  // after this module's static imports are evaluated under ESM ordering.
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !address) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.results[0]) {
      console.error(`Geocoding failed for "${address}": ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`);
      return null;
    }
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } catch (err) {
    console.error(`Geocoding request failed for "${address}": ${err.message}`);
    return null;
  }
}
