import { useState, useEffect, useCallback } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { useToast } from "../toast/useToast.js";
import { IconPlus, IconRoute, IconClock } from "../icons.jsx";
import { cellValue, formatTime12h } from "../utils.jsx";
import RunForm from "./RunForm.jsx";
import "../auth/auth.css";
import "./admin.css";

export default function ClubDashboard() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const clubs = user?.clubs || [];
  const [activeClubId, setActiveClubId] = useState(clubs[0]?.id ?? null);
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const activeClub = clubs.find((c) => c.id === activeClubId);

  const load = useCallback(() => {
    if (!activeClubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      authFetch(`/api/clubs/${activeClubId}/stats`, token),
      authFetch(`/api/clubs/${activeClubId}/runs`, token),
    ])
      .then(([statsData, runsData]) => {
        setStats(statsData);
        setRuns(runsData.runs);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeClubId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddRun = async (fields) => {
    await authFetch(`/api/clubs/${activeClubId}/runs`, token, {
      method: "POST",
      body: JSON.stringify(fields),
    });
    showToast("Run added");
    setFormOpen(false);
    load();
  };

  if (clubs.length === 0) {
    return <p className="status-text">You're not an admin of any club yet.</p>;
  }

  return (
    <div>
      {clubs.length > 1 && (
        <nav className="admin-tabs">
          {clubs.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`admin-tab${c.id === activeClubId ? " active" : ""}`}
              onClick={() => setActiveClubId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </nav>
      )}

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p className="status-text loading">Loading club dashboard…</p>
      ) : (
        <>
          <div className="detail-stats-grid">
            <div className="detail-stat-card">
              <span className="detail-stat-icon"><IconRoute /></span>
              <span className="detail-stat-label">Total Runs</span>
              <span className="detail-stat-value">{stats?.totalRuns ?? 0}</span>
            </div>
            <div className="detail-stat-card">
              <span className="detail-stat-icon"><IconClock /></span>
              <span className="detail-stat-label">Days Covered</span>
              <span className="detail-stat-value">{stats?.runsByDay?.length ?? 0}</span>
            </div>
          </div>

          <div className="admin-toolbar" style={{ marginTop: 24 }}>
            <h2 className="section-title" style={{ fontSize: "1.05rem" }}>{activeClub?.name} runs</h2>
            <button type="button" className="admin-btn-primary" onClick={() => setFormOpen(true)}>
              <IconPlus /> Add run
            </button>
          </div>

          {runs.length === 0 ? (
            <p className="status-text">No runs added yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Distance</th>
                    <th>Terrain</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>{cellValue(r.weekday)}</td>
                      <td>{cellValue(formatTime12h(r.start_times))}</td>
                      <td>{cellValue(r.meetup_location)}</td>
                      <td>{cellValue(r.average_distance)}</td>
                      <td>{cellValue(r.terrain)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {formOpen && <RunForm onSave={handleAddRun} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
