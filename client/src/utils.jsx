/* ---- Day-of-week filter options ---- */
export const WEEKDAYS = [
  { full: "Sunday",    short: "Sun" },
  { full: "Monday",    short: "Mon" },
  { full: "Tuesday",   short: "Tue" },
  { full: "Wednesday", short: "Wed" },
  { full: "Thursday",  short: "Thu" },
  { full: "Friday",    short: "Fri" },
  { full: "Saturday",  short: "Sat" },
];

/* ---- Coerce a caught fetch error (string, Error, or JSON-parse failure) into
   a renderable string, so it's always safe to drop into JSX ---- */
export const errorMessage = (err, fallback) =>
  (err instanceof Error ? err.message : typeof err === "string" ? err : null) || fallback;

/* ---- Render a field value, falling back to a muted em-dash ---- */
export const cellValue = (v) =>
  v === null || v === undefined || v === ""
    ? <span className="null-val">—</span>
    : String(v);

/* ---- AM/PM period from a 24-hour "HH:MM" start_times value, or null if
   it isn't in that format ---- */
export const timePeriod = (t) => {
  const m = String(t ?? "").match(/^([01]?\d|2[0-3]):[0-5]\d$/);
  if (!m) return null;
  return Number(m[1]) < 12 ? "AM" : "PM";
};

/* ---- Display-only: render a 24-hour "HH:MM" start_times value as 12-hour
   "H:MM AM/PM". Data stays 24-hour everywhere else (DB, forms, filtering) —
   this is purely for what the UI shows. Falls back to the raw value if it
   isn't in the expected format. ---- */
export const formatTime12h = (t) => {
  if (t === null || t === undefined || t === "") return t;
  const m = String(t).match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return t;
  const hour24 = Number(m[1]);
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${m[2]} ${period}`;
};

/* ---- Build a Google Maps search URL for a run's location ---- */
export const googleMapsUrl = (row) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [row.meetup_location, row.address_intersection].filter(Boolean).join(", ")
  )}`;

/* ---- Great-circle distance between two lat/lng points, in miles ---- */
export const haversineMiles = (lat1, lng1, lat2, lng2) => {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
};

/* ---- Load the Google Maps JS API script once and cache the promise, so
   navigating to the map view repeatedly doesn't inject the script twice ---- */
let googleMapsPromise = null;

export const loadGoogleMaps = () => {
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set."));
      return;
    }

    const callbackName = "__runsdbGoogleMapsLoaded";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps script."));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};
