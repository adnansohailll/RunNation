import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  IconArrowLeft, IconClock, IconMapPin, IconRoute, IconTerrain, IconUsers,
} from "./icons.jsx";
import { cellValue, errorMessage, formatTime12h, googleMapsUrl } from "./utils.jsx";
import RunComments from "./RunComments.jsx";

const STATS = [
  { key: "average_distance", label: "Distance",    Icon: IconRoute },
  { key: "terrain",          label: "Terrain",      Icon: IconTerrain },
  { key: "pace_groups",      label: "Pace Groups",  Icon: IconUsers },
];

export default function RunDetail() {
  const { id }              = useParams();
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
          <>
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
            </div>

            <div className="detail-stats-grid">
              {STATS.map(({ key, label, Icon }) => (
                <div key={key} className="detail-stat-card">
                  <span className="detail-stat-icon"><Icon /></span>
                  <span className="detail-stat-label">{label}</span>
                  <span className="detail-stat-value">{cellValue(run[key])}</span>
                </div>
              ))}
            </div>

            <RunComments runId={run.id} />
          </>
        )}
      </div>
    </main>
  );
}
