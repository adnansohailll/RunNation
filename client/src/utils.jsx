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
