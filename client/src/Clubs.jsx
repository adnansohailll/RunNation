import { useEffect, useState } from "react";
import { IconMapPin, IconMail, IconPhone, IconUsers } from "./icons.jsx";
import { errorMessage } from "./utils.jsx";

export default function Clubs() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    fetch("/api/clubs")
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      })
      .then((data) => setRows(data.clubs))
      .catch((err) => setError(errorMessage(err, "Failed to load clubs.")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="main">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Clubs</h2>
          {!loading && !error && (
            <span className="badge">{rows.length} club{rows.length === 1 ? "" : "s"}</span>
          )}
        </div>

        {loading && <p className="status-text loading">Loading clubs…</p>}

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="status-text">No clubs to show yet.</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="cards-grid">
            {rows.map((club) => (
              <div key={club.id} className="club-card">
                <div className="club-card-header">
                  {club.logo_url ? (
                    <img className="club-card-logo" src={club.logo_url} alt="" />
                  ) : (
                    <div className="club-card-logo club-card-logo-fallback">
                      <IconUsers />
                    </div>
                  )}
                  <h3 className="card-title">{club.name}</h3>
                </div>

                <div className="club-card-body">
                  {club.location && (
                    <p className="card-subtitle">
                      <IconMapPin />
                      <span>{club.location}</span>
                    </p>
                  )}
                  {club.description && (
                    <p className="club-card-description">{club.description}</p>
                  )}
                  <div className="club-card-contact">
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
                  {club.website && (
                    <a
                      className="club-card-website-btn"
                      href={club.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visit website
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
