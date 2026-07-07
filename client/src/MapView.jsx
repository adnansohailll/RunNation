import { useState, useEffect, useRef, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { loadGoogleMaps, WEEKDAYS, haversineMiles } from "./utils.jsx";
import { IconFilter, IconX, IconLocate, IconMapPin } from "./icons.jsx";

/* Default map center: Jersey Shore, NJ — falls back here when no run has
   coordinates yet (e.g. before the geocode script has been run). */
const DEFAULT_CENTER = { lat: 40.25, lng: -74.0 };

const RADIUS_OPTIONS = [1, 2, 5, 10, 25, 50];

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

export default function MapView() {
  const { search }              = useOutletContext();
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [mapsError, setMapsError] = useState(null);
  const [mapReady, setMapReady]   = useState(false);
  const [selectedDays, setSelectedDays] = useState(() => new Set());

  /* Radius filter state */
  const [addressInput, setAddressInput] = useState("");
  const [radiusMiles, setRadiusMiles]   = useState(10);
  const [centerPoint, setCenterPoint]   = useState(null); // { lat, lng }
  const [locating, setLocating]         = useState(false);
  const [geocoding, setGeocoding]       = useState(false);
  const [radiusError, setRadiusError]   = useState(null);

  const mapRef          = useRef(null);
  const mapObjRef        = useRef(null);
  const markersRef       = useRef([]);
  const infoWindowRef    = useRef(null);
  const centerMarkerRef  = useRef(null);
  const radiusCircleRef  = useRef(null);

  /* Fetch runs data */
  useEffect(() => {
    fetch("/api/runs")
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      })
      .then((data) => setRows(data.rows))
      .catch((err) => setError(err || "Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  /* Initialise the map once */
  useEffect(() => {
    loadGoogleMaps()
      .then((maps) => {
        if (!mapRef.current || mapObjRef.current) return;
        mapObjRef.current = new maps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: 11,
        });
        infoWindowRef.current = new maps.InfoWindow();
        setMapReady(true);
      })
      .catch((err) => setMapsError(err.message));
  }, []);

  const toggleDay = (full) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      next.has(full) ? next.delete(full) : next.add(full);
      return next;
    });
  };

  const clearDays = () => setSelectedDays(new Set());

  /* "Locate me" — use the browser's geolocation as the radius search centre */
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setRadiusError("Geolocation is not supported by your browser.");
      return;
    }
    setRadiusError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenterPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAddressInput("My current location");
        setLocating(false);
      },
      (err) => {
        setRadiusError(`Could not get your location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /* Geocode the typed address into the radius search centre */
  const handleGeocodeSearch = () => {
    const address = addressInput.trim();
    if (!address) return;
    if (!mapReady || !window.google?.maps) {
      setRadiusError("Map is still loading — try again in a moment.");
      return;
    }
    setRadiusError(null);
    setGeocoding(true);

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      setGeocoding(false);
      setRadiusError("Search timed out. Please check your connection and try again.");
    }, 8000);

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      setGeocoding(false);
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        setCenterPoint({ lat: loc.lat(), lng: loc.lng() });
      } else {
        setRadiusError("Could not find that address.");
      }
    });
  };

  const clearRadius = () => {
    setCenterPoint(null);
    setAddressInput("");
    setRadiusError(null);
  };

  /* Filter rows by search (mirrors Dashboard's search behaviour) and selected weekdays */
  const filtered = useMemo(() => rows.filter((row) => {
    const matchesSearch = Object.keys(row).some((col) =>
      String(row[col] ?? "").toLowerCase().includes(search.toLowerCase())
    );
    const matchesDay = selectedDays.size === 0 || selectedDays.has(row.weekday);
    return matchesSearch && matchesDay;
  }), [rows, search, selectedDays]);

  const located = useMemo(
    () => filtered.filter((row) => row.latitude != null && row.longitude != null),
    [filtered]
  );

  /* Further narrow located runs down to those inside the radius, if a centre point is set */
  const visible = useMemo(() => {
    if (!centerPoint) return located;
    return located.filter(
      (row) =>
        haversineMiles(centerPoint.lat, centerPoint.lng, Number(row.latitude), Number(row.longitude)) <=
        radiusMiles
    );
  }, [located, centerPoint, radiusMiles]);

  const unlocated     = filtered.length - located.length;
  const outsideRadius = centerPoint ? located.length - visible.length : 0;

  /* Redraw markers, and the radius centre/circle, whenever they change or the map finishes loading */
  useEffect(() => {
    if (!mapReady || !mapObjRef.current) return;
    const maps = window.google.maps;
    const map  = mapObjRef.current;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (centerMarkerRef.current) { centerMarkerRef.current.setMap(null); centerMarkerRef.current = null; }
    if (radiusCircleRef.current)  { radiusCircleRef.current.setMap(null); radiusCircleRef.current = null; }

    const bounds = new maps.LatLngBounds();
    let hasBounds = false;

    if (centerPoint) {
      centerMarkerRef.current = new maps.Marker({
        map,
        position: centerPoint,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#c9963a",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: 999,
        title: "Search centre",
      });
      radiusCircleRef.current = new maps.Circle({
        map,
        center: centerPoint,
        radius: radiusMiles * 1609.34,
        strokeColor: "#c9963a",
        strokeOpacity: 0.7,
        strokeWeight: 2,
        fillColor: "#c9963a",
        fillOpacity: 0.08,
      });
      bounds.union(radiusCircleRef.current.getBounds());
      hasBounds = true;
    }

    visible.forEach((row) => {
      const position = { lat: Number(row.latitude), lng: Number(row.longitude) };
      const marker = new maps.Marker({ map, position, title: row.meetup_location });

      marker.addListener("click", () => {
        infoWindowRef.current.setContent(`
          <div class="map-info-window">
            <strong>${escapeHtml(row.meetup_location)}</strong>
            ${row.address_intersection ? `<div>${escapeHtml(row.address_intersection)}</div>` : ""}
            <div>${escapeHtml(row.weekday)} · ${escapeHtml(row.start_times)}</div>
            <a href="/run/${encodeURIComponent(row.id)}">View details →</a>
          </div>
        `);
        infoWindowRef.current.open({ map, anchor: marker });
      });

      markersRef.current.push(marker);
      bounds.extend(position);
      hasBounds = true;
    });

    if (!hasBounds) return;

    if (!centerPoint && visible.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(13);
    } else {
      map.fitBounds(bounds);
    }
  }, [visible, centerPoint, radiusMiles, mapReady]);

  return (
    <main className="main">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Run Locations</h2>
          {!loading && !error && (
            <span className="badge">{visible.length} on map</span>
          )}
        </div>

        {!loading && !error && rows.length > 0 && (
          <div className="day-filter">
            <span className="day-filter-label">
              <IconFilter />
              Day
            </span>
            <div className="day-chip-row">
              <button
                className={`day-chip${selectedDays.size === 0 ? " active" : ""}`}
                onClick={clearDays}
              >
                All
              </button>
              {WEEKDAYS.map(({ full, short }) => (
                <button
                  key={full}
                  className={`day-chip${selectedDays.has(full) ? " active" : ""}`}
                  onClick={() => toggleDay(full)}
                  aria-pressed={selectedDays.has(full)}
                >
                  {short}
                </button>
              ))}
            </div>
            {selectedDays.size > 0 && (
              <button className="day-filter-clear" onClick={clearDays}>
                <IconX />
                Clear
              </button>
            )}
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="day-filter radius-filter">
            <span className="day-filter-label">
              <IconMapPin />
              Near
            </span>
            <div className="radius-controls">
              <div className="radius-input-wrap">
                <input
                  type="text"
                  className="radius-address-input"
                  placeholder="Enter an address…"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGeocodeSearch()}
                />
                <button
                  type="button"
                  className="locate-btn"
                  onClick={handleLocateMe}
                  disabled={locating}
                  aria-label="Use my current location"
                >
                  <IconLocate />
                  <span>{locating ? "Locating…" : "Locate me"}</span>
                  <span className="tooltip-bubble" role="tooltip">
                    Use your device's location
                  </span>
                </button>
              </div>
              <select
                className="radius-select"
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(Number(e.target.value))}
                aria-label="Search radius"
              >
                {RADIUS_OPTIONS.map((mi) => (
                  <option key={mi} value={mi}>{mi} mi</option>
                ))}
              </select>
              <button
                type="button"
                className="radius-search-btn"
                onClick={handleGeocodeSearch}
                disabled={geocoding || !addressInput.trim()}
              >
                {geocoding ? "Searching…" : "Search"}
              </button>
            </div>
            {centerPoint && (
              <button className="day-filter-clear" onClick={clearRadius}>
                <IconX />
                Clear
              </button>
            )}
          </div>
        )}

        {radiusError && (
          <div className="error-box">
            <strong>Error:</strong> {radiusError}
          </div>
        )}

        {loading && <p className="status-text loading">Loading data…</p>}

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {mapsError && (
          <div className="error-box">
            <strong>Map failed to load:</strong> {mapsError}
          </div>
        )}

        {!loading && !error && unlocated > 0 && (
          <p className="status-text map-unlocated-note">
            {unlocated} run{unlocated === 1 ? "" : "s"} could not be plotted (no coordinates yet).
          </p>
        )}

        {!loading && !error && outsideRadius > 0 && (
          <p className="status-text map-unlocated-note">
            {outsideRadius} run{outsideRadius === 1 ? "" : "s"} outside the selected radius.
          </p>
        )}

        <div className="map-canvas" ref={mapRef} />
      </div>
    </main>
  );
}
