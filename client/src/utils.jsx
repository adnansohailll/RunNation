/* ---- Render a field value, falling back to a muted em-dash ---- */
export const cellValue = (v) =>
  v === null || v === undefined || v === ""
    ? <span className="null-val">—</span>
    : String(v);

/* ---- Build a Google Maps search URL for a run's location ---- */
export const googleMapsUrl = (row) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [row.meetup_location, row.address_intersection].filter(Boolean).join(", ")
  )}`;
