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
