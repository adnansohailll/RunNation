import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { loadGoogleMaps } from "./utils.jsx";

/* Default map center: Jersey Shore, NJ — falls back here when no run has
   coordinates yet (e.g. before the geocode script has been run). */
const DEFAULT_CENTER = { lat: 40.25, lng: -74.0 };

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

  const mapRef       = useRef(null);
  const mapObjRef     = useRef(null);
  const markersRef    = useRef([]);
  const infoWindowRef = useRef(null);

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

  /* Filter rows by search (mirrors Dashboard's search behaviour) */
  const filtered = rows.filter((row) =>
    Object.keys(row).some((col) =>
      String(row[col] ?? "").toLowerCase().includes(search.toLowerCase())
    )
  );
  const located   = filtered.filter((row) => row.latitude != null && row.longitude != null);
  const unlocated = filtered.length - located.length;

  /* Redraw markers whenever the located runs change, or once the map finishes loading */
  useEffect(() => {
    if (!mapReady || !mapObjRef.current) return;
    const maps = window.google.maps;
    const map  = mapObjRef.current;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (located.length === 0) return;

    const bounds = new maps.LatLngBounds();

    located.forEach((row) => {
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
    });

    if (located.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(13);
    } else {
      map.fitBounds(bounds);
    }
  }, [located, mapReady]);

  return (
    <main className="main">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Run Locations</h2>
          {!loading && !error && (
            <span className="badge">{located.length} on map</span>
          )}
        </div>

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

        <div className="map-canvas" ref={mapRef} />
      </div>
    </main>
  );
}
