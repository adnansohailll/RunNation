import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  IconArrowLeft, IconArrowRight, IconMapPin, IconMail, IconPhone,
  IconUsers, IconClock, IconRoute, IconTerrain, IconInfo,
} from "./icons.jsx";
import { cellValue, errorMessage, formatTime12h } from "./utils.jsx";

export default function ClubDetail() {
  const { id }                = useParams();
  const [club, setClub]       = useState(null);
  const [runs, setRuns]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  /* Reset loading/error state when navigating to a different club. Adjusting
     state during render (rather than in an effect) avoids an extra re-render. */
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/clubs/${id}`).then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      }),
      fetch("/api/runs").then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      }),
    ])
      .then(([clubData, runsData]) => {
        setClub(clubData.club);
        setRuns(runsData.rows.filter((r) => r.club_id === Number(id)));
      })
      .catch((err) => setError(errorMessage(err, "Failed to load club.")))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <main className="main">
      <div className="container detail-container club-detail-container">
        <Link to="/clubs" className="detail-back-link">
          <IconArrowLeft />
          Back to all clubs
        </Link>

        {loading && (
          <p className="status-text loading">Loading club details…</p>
        )}

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && club && (
          <>
            <div className="detail-hero">
              <div className="detail-hero-badge detail-hero-badge-center">
                {club.logo_url ? (
                  <img className="club-card-logo" style={{ width: 64, height: 64 }} src={club.logo_url} alt="" />
                ) : (
                  <div className="club-card-logo club-card-logo-fallback" style={{ width: 64, height: 64 }}>
                    <IconUsers />
                  </div>
                )}
              </div>

              <div className="detail-hero-body">
                <h1 className="detail-hero-title">{club.name}</h1>

                {club.location && (
                  <p className="detail-hero-address">
                    <IconMapPin />
                    <span>{club.location}</span>
                  </p>
                )}

                {club.description && (
                  <p className="club-card-description detail-hero-description">
                    <IconInfo />
                    <span>{club.description}</span>
                  </p>
                )}

                {(club.contact_email || club.contact_phone) && (
                  <div className="club-card-contact" style={{ marginTop: 12 }}>
                    {club.contact_email && (
                      <a className="club-card-contact-link" href={`mailto:${club.contact_email}`}>
                        <IconMail /> {club.contact_email}
                      </a>
                    )}
                    {club.contact_phone && (
                      <a className="club-card-contact-link" href={`tel:${club.contact_phone}`}>
                        <IconPhone /> {club.contact_phone}
                      </a>
                    )}
                  </div>
                )}

                {club.website && (
                  <a
                    className="detail-directions-btn"
                    href={club.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit website
                  </a>
                )}
              </div>
            </div>

            <div className="section-header" style={{ marginTop: 28 }}>
              <h2 className="section-title" style={{ fontSize: "1.1rem" }}>Runs</h2>
              <span className="badge">{runs.length} run{runs.length === 1 ? "" : "s"}</span>
            </div>

            {runs.length === 0 ? (
              <p className="status-text">No runs added for this club yet.</p>
            ) : (
              <div className="cards-grid">
                {runs.map((r) => (
                  <div key={r.id} className="run-card">
                    <div className="card-day-col">
                      <span className="badge-day">{cellValue(r.weekday)}</span>
                      <span className="badge-time">
                        <IconClock />
                        {cellValue(formatTime12h(r.start_times))}
                      </span>
                    </div>

                    <div className="card-main">
                      <div className="card-info">
                        <h3 className="card-title">{cellValue(r.meetup_location)}</h3>
                        {r.address_intersection && (
                          <p className="card-subtitle">
                            <IconMapPin />
                            <span>{r.address_intersection}</span>
                          </p>
                        )}
                      </div>

                      <div className="card-vdivider" />

                      <div className="card-stats">
                        <div className="stat-row">
                          <span className="stat-icon"><IconRoute /></span>
                          <span className="stat-text">
                            <span className="stat-label">Distance</span>
                            <span className="stat-value">{cellValue(r.average_distance)}</span>
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-icon"><IconTerrain /></span>
                          <span className="stat-text">
                            <span className="stat-label">Terrain</span>
                            <span className="stat-value">{cellValue(r.terrain)}</span>
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-icon"><IconUsers /></span>
                          <span className="stat-text">
                            <span className="stat-label">Pace Groups</span>
                            <span className="stat-value">{cellValue(r.pace_groups)}</span>
                          </span>
                        </div>
                      </div>

                      <Link to={`/run/${r.id}`} className="card-details-btn">
                        Details
                        <IconArrowRight />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
