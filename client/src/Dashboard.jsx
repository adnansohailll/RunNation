import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  IconClock, IconMapPin, IconRoute, IconTerrain, IconUsers, IconArrowRight,
  IconFilter, IconX, IconLocate, IconList, IconMap,
} from "./icons.jsx";
import { cellValue, errorMessage, formatTime12h, googleMapsUrl, loadGoogleMaps, WEEKDAYS, haversineMiles, timePeriod } from "./utils.jsx";
import banner1 from "./assets/images/banner-1.jpg";
import banner2 from "./assets/images/banner-2.jpg";
import banner3 from "./assets/images/banner-3.jpg";

/* ---- Banner slides ---- */
const SLIDES = [banner1, banner2, banner3];

const CARDS_PER_PAGE = 32;

/* Default map center: Jersey Shore, NJ — falls back here when no run has
   coordinates yet (e.g. before the geocode script has been run). */
const DEFAULT_CENTER = { lat: 40.25, lng: -74.0 };

const RADIUS_OPTIONS = [1, 2, 5, 10, 25, 50];

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

export default function Dashboard() {
  const [rows, setRows]        = useState([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState(null);
  const [activeSlide, setSlide] = useState(0);
  const [page, setPage]        = useState(1);
  const [selectedDays, setSelectedDays] = useState(() => new Set());
  const [selectedPeriods, setSelectedPeriods] = useState(() => new Set()); // "AM" | "PM"
  const [view, setView]        = useState("list"); // "list" | "map"
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* Radius ("Near") filter state — shared between the list and map views */
  const [addressInput, setAddressInput] = useState("");
  const [radiusMiles, setRadiusMiles]   = useState(10);
  const [centerPoint, setCenterPoint]   = useState(null); // { lat, lng }
  const [locating, setLocating]         = useState(false);
  const [geocoding, setGeocoding]       = useState(false);
  const [radiusError, setRadiusError]   = useState(null);

  /* Map view state */
  const [mapsApiReady, setMapsApiReady] = useState(false);
  const [mapsError, setMapsError]       = useState(null);
  const [mapReady, setMapReady]         = useState(false);

  const mapRef          = useRef(null);
  const mapObjRef        = useRef(null);
  const markersRef       = useRef([]);
  const infoWindowRef    = useRef(null);
  const centerMarkerRef  = useRef(null);
  const radiusCircleRef  = useRef(null);

  /* Auto-rotate banner — banner disabled for now, see render below */
  // useEffect(() => {
  //   const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
  //   return () => clearInterval(id);
  // }, []);

  /* Fetch runs data */
  useEffect(() => {
    fetch("/api/runs")
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      })
      .then((data) => setRows(data.rows))
      .catch((err) => setError(errorMessage(err, "Failed to load data.")))
      .finally(() => setLoading(false));
  }, []);

  /* Load the Google Maps API once — needed for the map view and for
     geocoding addresses typed into the "Near" filter. */
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsApiReady(true))
      .catch((err) => setMapsError(err.message));
  }, []);

  /* Create the map object the first time the map view becomes visible */
  useEffect(() => {
    if (view !== "map" || !mapsApiReady || !mapRef.current || mapObjRef.current) return;
    const maps = window.google.maps;
    mapObjRef.current = new maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 11,
    });
    infoWindowRef.current = new maps.InfoWindow();
    setMapReady(true);
  }, [view, mapsApiReady]);

  const toggleDay = (full) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      next.has(full) ? next.delete(full) : next.add(full);
      return next;
    });
  };

  const clearDays = () => setSelectedDays(new Set());

  const togglePeriod = (period) => {
    setSelectedPeriods((prev) => {
      const next = new Set(prev);
      next.has(period) ? next.delete(period) : next.add(period);
      return next;
    });
  };

  const clearPeriods = () => setSelectedPeriods(new Set());

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
    if (!mapsApiReady || !window.google?.maps) {
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

  /* Filter rows by selected weekdays, then by AM/PM period */
  const dayFiltered = useMemo(
    () => rows.filter((row) => selectedDays.size === 0 || selectedDays.has(row.weekday)),
    [rows, selectedDays]
  );

  const periodFiltered = useMemo(
    () => dayFiltered.filter((row) => {
      if (selectedPeriods.size === 0) return true;
      const period = timePeriod(row.start_times);
      return period !== null && selectedPeriods.has(period);
    }),
    [dayFiltered, selectedPeriods]
  );

  const located = useMemo(
    () => periodFiltered.filter((row) => row.latitude != null && row.longitude != null),
    [periodFiltered]
  );

  /* Rows within the radius filter (if a centre point is set) — this is what
     the map plots, and what the list narrows down to as well, so both views
     always agree on what's showing. */
  const withinRadius = useMemo(() => {
    if (!centerPoint) return located;
    return located.filter(
      (row) =>
        haversineMiles(centerPoint.lat, centerPoint.lng, Number(row.latitude), Number(row.longitude)) <=
        radiusMiles
    );
  }, [located, centerPoint, radiusMiles]);

  const listRows = centerPoint ? withinRadius : periodFiltered;
  const mapRows  = withinRadius;

  const unlocated     = periodFiltered.length - located.length;
  const outsideRadius = centerPoint ? located.length - withinRadius.length : 0;

  /* Runs the current view is hiding because of the radius filter — the map
     always excludes unlocated runs, while the list only does once a centre
     point narrows it down (see listRows/mapRows above). */
  const excludedCount = view === "map" ? unlocated + outsideRadius : (centerPoint ? unlocated + outsideRadius : 0);

  /* Reset to page 1 whenever the day, period, or radius filter changes.
     Adjusting state during render (rather than in an effect) avoids an
     extra re-render. */
  const filterKey = `${[...selectedDays].sort().join(",")}|${[...selectedPeriods].sort().join(",")}|${
    centerPoint ? `${centerPoint.lat},${centerPoint.lng},${radiusMiles}` : ""
  }`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  /* Pagination (list view) */
  const totalPages = Math.max(1, Math.ceil(listRows.length / CARDS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = listRows.slice((safePage - 1) * CARDS_PER_PAGE, safePage * CARDS_PER_PAGE);

  const getPageNums = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const left  = Math.max(2, safePage - 2);
    const right = Math.min(totalPages - 1, safePage + 2);
    const nums  = [1];
    if (left > 2) nums.push("...");
    for (let i = left; i <= right; i++) nums.push(i);
    if (right < totalPages - 1) nums.push("...");
    nums.push(totalPages);
    return nums;
  };

  /* Redraw markers, and the radius centre/circle, whenever they change. The
     map canvas stays mounted (just hidden) when switching to list view, so
     trigger a resize when it becomes visible again to fix Google Maps'
     stale tile layout. */
  useEffect(() => {
    if (!mapReady) return;
    const maps = window.google.maps;
    const map  = mapObjRef.current;

    if (view === "map") maps.event.trigger(map, "resize");

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

    mapRows.forEach((row) => {
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

    if (!centerPoint && mapRows.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(13);
    } else {
      map.fitBounds(bounds);
    }
  }, [mapRows, centerPoint, radiusMiles, mapReady, view]);

  return (
    <>
      {/* ====== BANNER (disabled for now — taking up too much space) ======
      <div className="banner" aria-hidden="true">
        {SLIDES.map((src, i) => (
          <div
            key={i}
            className={`banner-slide ${i === activeSlide ? "active" : ""}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
      </div>
      ============================================================ */}

      {/* ====== MAIN ====== */}
      <main className="main">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Group Runs</h2>
            {!loading && !error && (
              <span className="badge">
                {view === "map" ? `${mapRows.length} on map` : `${listRows.length} runs`}
              </span>
            )}
            {!loading && !error && excludedCount > 0 && (
              <span className="badge badge-muted">
                {excludedCount} run{excludedCount === 1 ? "" : "s"} outside the selected radius
              </span>
            )}
            {!loading && !error && rows.length > 0 && (
              <div className="section-header-actions">
                <button
                  type="button"
                  className={`filters-toggle-btn${filtersOpen ? " active" : ""}`}
                  onClick={() => setFiltersOpen((o) => !o)}
                  aria-expanded={filtersOpen}
                  aria-label={filtersOpen ? "Hide filters" : "Show filters"}
                >
                  <IconFilter />
                </button>

                <div className="view-toggle" role="group" aria-label="Switch view">
                  <button
                    type="button"
                    className={`view-toggle-btn${view === "list" ? " active" : ""}`}
                    onClick={() => setView("list")}
                    aria-pressed={view === "list"}
                  >
                    <IconList />
                    List
                  </button>
                  <button
                    type="button"
                    className={`view-toggle-btn${view === "map" ? " active" : ""}`}
                    onClick={() => setView("map")}
                    aria-pressed={view === "map"}
                  >
                    <IconMap />
                    Map
                  </button>
                </div>
              </div>
            )}
          </div>

          {!loading && !error && rows.length > 0 && (
            <div className={`filters-panel${filtersOpen ? " open" : ""}`}>
              <div className="filters-panel-inner">
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

                <div className="day-filter">
                  <span className="day-filter-label">
                    <IconClock />
                    Time
                  </span>
                  <div className="day-chip-row">
                    <button
                      className={`day-chip${selectedPeriods.size === 0 ? " active" : ""}`}
                      onClick={clearPeriods}
                    >
                      All
                    </button>
                    {["AM", "PM"].map((period) => (
                      <button
                        key={period}
                        className={`day-chip${selectedPeriods.has(period) ? " active" : ""}`}
                        onClick={() => togglePeriod(period)}
                        aria-pressed={selectedPeriods.has(period)}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                  {selectedPeriods.size > 0 && (
                    <button className="day-filter-clear" onClick={clearPeriods}>
                      <IconX />
                      Clear
                    </button>
                  )}
                </div>

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

                {radiusError && (
                  <div className="error-box">
                    <strong>Error:</strong> {radiusError}
                  </div>
                )}
              </div>
            </div>
          )}

          {loading && (
            <p className="status-text loading">Loading data…</p>
          )}

          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <p className="status-text">No records found in run_metadata.</p>
          )}

          {!loading && !error && rows.length > 0 && (
            <>
              {/* ====== LIST VIEW ====== */}
              <div style={{ display: view === "list" ? "block" : "none" }}>
                {listRows.length === 0 ? (
                  <p className="status-text">No runs match your filters.</p>
                ) : (
                  <div className="cards-grid">
                    {pageRows.map((row, idx) => (
                      <div key={idx} className="run-card">
                        <div className="card-day-col">
                          <span className="badge-day">{cellValue(row.weekday)}</span>
                          <span className="badge-time">
                            <IconClock />
                            {cellValue(formatTime12h(row.start_times))}
                          </span>
                        </div>

                        <div className="card-main">
                          <div className="card-info">
                            <h3 className="card-title">{cellValue(row.meetup_location)}</h3>
                            {row.address_intersection && (
                              <a
                                className="card-subtitle card-map-link"
                                href={googleMapsUrl(row)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <IconMapPin />
                                <span>{row.address_intersection}</span>
                              </a>
                            )}
                          </div>

                          <div className="card-vdivider" />

                          <div className="card-stats">
                            <div className="stat-row">
                              <span className="stat-icon"><IconRoute /></span>
                              <span className="stat-text">
                                <span className="stat-label">Distance</span>
                                <span className="stat-value">{cellValue(row.average_distance)}</span>
                              </span>
                            </div>
                            <div className="stat-row">
                              <span className="stat-icon"><IconTerrain /></span>
                              <span className="stat-text">
                                <span className="stat-label">Terrain</span>
                                <span className="stat-value">{cellValue(row.terrain)}</span>
                              </span>
                            </div>
                            <div className="stat-row">
                              <span className="stat-icon"><IconUsers /></span>
                              <span className="stat-text">
                                <span className="stat-label">Pace Groups</span>
                                <span className="stat-value">{cellValue(row.pace_groups)}</span>
                              </span>
                            </div>
                          </div>

                          <Link to={`/run/${row.id}`} className="card-details-btn">
                            Details
                            <IconArrowRight />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="page-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                    >
                      ← Prev
                    </button>

                    {getPageNums().map((n, i) =>
                      n === "..." ? (
                        <span key={`e${i}`} className="page-ellipsis">…</span>
                      ) : (
                        <button
                          key={n}
                          className={`page-btn${n === safePage ? " active" : ""}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      )
                    )}

                    <button
                      className="page-btn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>

              {/* ====== MAP VIEW ====== */}
              <div style={{ display: view === "map" ? "block" : "none" }}>
                {mapsError && (
                  <div className="error-box">
                    <strong>Map failed to load:</strong> {mapsError}
                  </div>
                )}

                <div className="map-canvas" ref={mapRef} />
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
