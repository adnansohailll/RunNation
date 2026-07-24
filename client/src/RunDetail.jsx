import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IconArrowLeft, IconClock, IconMapPin } from "./icons.jsx";
import { cellValue, errorMessage, formatTime12h, googleMapsUrl } from "./utils.jsx";
import { dateOnly, isValidOccurrence } from "./runOccurrences.js";
import RunComments from "./RunComments.jsx";
import RunCalendar from "./RunCalendar.jsx";

const STATS = [
  { key: "average_distance", label: "Distance" },
  { key: "terrain",          label: "Terrain" },
  { key: "pace_groups",      label: "Pace Groups" },
];

export default function RunDetail() {
  const { id, date }        = useParams();
  const navigate            = useNavigate();
  const [run, setRun]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  /* Reset loading/error state when navigating to a different run. Adjusting
     state during render (rather than in an effect) avoids an extra re-render. */
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    fetch(`/api/runs/${id}`)
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      })
      .then((data) => setRun(data.row))
      .catch((err) => setError(errorMessage(err, "Failed to load run.")))
      .finally(() => setLoading(false));
  }, [id]);

  /* Bounce back to the main run page if the URL's date doesn't match a real
     occurrence of this run (wrong weekday, or outside the supported range). */
  useEffect(() => {
    if (!run || !date) return;
    const minDate = dateOnly(new Date(run.created_at));
    const maxDate = dateOnly(new Date());
    maxDate.setMonth(maxDate.getMonth() + 1);
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime()) || !isValidOccurrence(run.weekday, parsed, minDate, maxDate)) {
      navigate(`/run/${id}`, { replace: true });
    }
  }, [run, date, id, navigate]);

  return (
    <main className="main">
      <div className="container detail-container">
        <Link to="/" className="detail-back-link">
          <IconArrowLeft />
          Back to all runs
        </Link>

        {loading && (
          <p className="status-text loading">Loading run details…</p>
        )}

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && run && (
          <div className="detail-content-grid">
            <div className="detail-main-col">
              <div className="detail-hero">
                <div className="detail-hero-badge">
                  <span className="detail-hero-day">{cellValue(run.weekday)}</span>
                  <span className="detail-hero-time">
                    <IconClock />
                    {cellValue(formatTime12h(run.start_times))}
                  </span>
                </div>

                <div className="detail-hero-body">
                  <h1 className="detail-hero-title">{cellValue(run.meetup_location)}</h1>
                  {run.address_intersection && (
                    <p className="detail-hero-address">
                      <IconMapPin />
                      <span>{run.address_intersection}</span>
                    </p>
                  )}

                  {run.address_intersection && (
                    <a
                      className="detail-directions-btn"
                      href={googleMapsUrl(run)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <IconMapPin />
                      Get Directions
                    </a>
                  )}
                </div>

                <div className="detail-hero-meta">
                  {STATS.map(({ key, label }) => (
                    <div key={key} className="detail-hero-meta-item">
                      <span className="detail-hero-meta-label">{label}</span>
                      <span className="detail-hero-meta-value">{cellValue(run[key])}</span>
                    </div>
                  ))}
                </div>
              </div>

              {date && (
                <div className="comment-scope-banner">
                  Viewing comments for{" "}
                  {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "long", month: "short", day: "numeric", year: "numeric",
                  })}
                  <Link to={`/run/${id}`}>← Back to general discussion</Link>
                </div>
              )}

              <RunComments runId={run.id} occurrenceDate={date} />
            </div>

            <div className="detail-side-col">
              <RunCalendar
                weekday={run.weekday}
                earliest={run.created_at}
                selectedDate={date}
                onSelectDate={(iso) => navigate(`/run/${id}/${iso}`)}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
