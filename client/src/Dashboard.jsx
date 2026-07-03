import { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  IconClock, IconMapPin, IconRoute, IconTerrain, IconUsers, IconArrowRight,
  IconFilter, IconX,
} from "./icons.jsx";
import { cellValue, googleMapsUrl } from "./utils.jsx";
import banner1 from "./assets/images/banner-1.jpg";
import banner2 from "./assets/images/banner-2.jpg";
import banner3 from "./assets/images/banner-3.jpg";

/* ---- Day-of-week filter options ---- */
const WEEKDAYS = [
  { full: "Sunday",    short: "Sun" },
  { full: "Monday",    short: "Mon" },
  { full: "Tuesday",   short: "Tue" },
  { full: "Wednesday", short: "Wed" },
  { full: "Thursday",  short: "Thu" },
  { full: "Friday",    short: "Fri" },
  { full: "Saturday",  short: "Sat" },
];

/* ---- Banner slides ---- */
const SLIDES = [banner1, banner2, banner3];

const CARDS_PER_PAGE = 32;
const HIDDEN_COLS    = new Set(["id", "event_url"]);

export default function Dashboard() {
  const { search }             = useOutletContext();
  const [columns, setColumns]  = useState([]);
  const [rows, setRows]        = useState([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState(null);
  const [activeSlide, setSlide] = useState(0);
  const [page, setPage]        = useState(1);
  const [selectedDays, setSelectedDays] = useState(() => new Set());

  /* Auto-rotate banner */
  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  /* Fetch runs data */
  useEffect(() => {
    fetch("/api/runs")
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      })
      .then((data) => {
        setColumns(data.columns);
        setRows(data.rows);
      })
      .catch((err) => setError(err || "Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  /* Columns to display — strip hidden ones */
  const visibleCols = columns.filter((c) => !HIDDEN_COLS.has(c));

  const toggleDay = (full) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      next.has(full) ? next.delete(full) : next.add(full);
      return next;
    });
  };

  const clearDays = () => setSelectedDays(new Set());

  /* Filter rows by search query (visible columns) and selected weekdays */
  const filtered = rows.filter((row) => {
    const matchesSearch = visibleCols.some((col) =>
      String(row[col] ?? "").toLowerCase().includes(search.toLowerCase())
    );
    const matchesDay = selectedDays.size === 0 || selectedDays.has(row.weekday);
    return matchesSearch && matchesDay;
  });

  /* Reset to page 1 whenever search or day filter changes */
  useEffect(() => { setPage(1); }, [search, selectedDays]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * CARDS_PER_PAGE, safePage * CARDS_PER_PAGE);

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

  return (
    <>
      {/* ====== BANNER ====== */}
      <div className="banner" aria-hidden="true">
        {SLIDES.map((src, i) => (
          <div
            key={i}
            className={`banner-slide ${i === activeSlide ? "active" : ""}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
      </div>

      {/* ====== MAIN ====== */}
      <main className="main">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Group Runs</h2>
            {!loading && !error && (
              <span className="badge">{filtered.length} runs</span>
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
              {filtered.length === 0 ? (
                <p className="status-text">No runs match your filters.</p>
              ) : (
                <div className="cards-grid">
                  {pageRows.map((row, idx) => (
                    <div key={idx} className="run-card">
                      <div className="card-day-col">
                        <span className="badge-day">{cellValue(row.weekday)}</span>
                        <span className="badge-time">
                          <IconClock />
                          {cellValue(row.start_times)}
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
            </>
          )}
        </div>
      </main>
    </>
  );
}
