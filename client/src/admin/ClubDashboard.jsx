import { useState, useEffect, useCallback } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { useToast } from "../toast/useToast.js";
import { IconPlus, IconRoute, IconClock, IconTrash, IconCheckCircle, IconX } from "../icons.jsx";
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
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [removingUserId, setRemovingUserId] = useState(null);
  const [activeSection, setActiveSection] = useState("runs");

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
      authFetch(`/api/clubs/${activeClubId}/join-requests`, token),
    ])
      .then(([statsData, runsData, joinRequestsData]) => {
        setStats(statsData);
        setRuns(runsData.runs);
        setJoinRequests(joinRequestsData.requests);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeClubId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingRequests = joinRequests.filter((r) => r.status === "pending");
  const members = joinRequests.filter((r) => r.status === "approved");

  const handleRespond = async (request, status) => {
    setRespondingId(request.id);
    try {
      await authFetch(`/api/clubs/${activeClubId}/join-requests/${request.id}/respond`, token, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      showToast(status === "approved" ? "Request approved" : "Request rejected");
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setRespondingId(null);
    }
  };

  const handleRemoveMember = async (member) => {
    if (!confirm(`Remove ${member.user_name || member.user_email} from ${activeClub?.name}?`)) return;
    setRemovingUserId(member.user_id);
    try {
      await authFetch(`/api/clubs/${activeClubId}/members/${member.user_id}`, token, { method: "DELETE" });
      showToast("Member removed");
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleAddRun = async (fields) => {
    await authFetch(`/api/clubs/${activeClubId}/runs`, token, {
      method: "POST",
      body: JSON.stringify(fields),
    });
    showToast("Run added");
    setFormOpen(false);
    load();
  };

  const handleDeleteRun = async (run) => {
    if (!confirm(`Delete the ${run.weekday} run at "${run.meetup_location}"? This cannot be undone.`)) return;
    try {
      await authFetch(`/api/clubs/${activeClubId}/runs/${run.id}`, token, { method: "DELETE" });
      showToast("Run deleted");
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
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

          <nav className="admin-tabs" style={{ marginTop: 24 }}>
            <button
              type="button"
              className={`admin-tab${activeSection === "runs" ? " active" : ""}`}
              onClick={() => setActiveSection("runs")}
            >
              Runs ({runs.length})
            </button>
            <button
              type="button"
              className={`admin-tab${activeSection === "users" ? " active" : ""}`}
              onClick={() => setActiveSection("users")}
            >
              Users ({members.length})
            </button>
            <button
              type="button"
              className={`admin-tab${activeSection === "requests" ? " active" : ""}`}
              onClick={() => setActiveSection("requests")}
            >
              Pending Requests ({pendingRequests.length})
            </button>
          </nav>

          {activeSection === "runs" && (
            <>
              <div className="admin-toolbar" style={{ marginTop: 20 }}>
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
                        <th></th>
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
                          <td className="admin-table-actions">
                            <button type="button" className="admin-icon-btn danger" onClick={() => handleDeleteRun(r)} aria-label="Delete run">
                              <IconTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeSection === "users" && (
            <>
              <div className="admin-toolbar" style={{ marginTop: 20 }}>
                <h2 className="section-title" style={{ fontSize: "1.05rem" }}>Members</h2>
                <span className="badge">{members.length} member{members.length === 1 ? "" : "s"}</span>
              </div>

              {members.length === 0 ? (
                <p className="status-text">No members yet.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Member since</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id}>
                          <td>{cellValue(m.user_name)}</td>
                          <td>{cellValue(m.user_email)}</td>
                          <td>{new Date(m.responded_at).toLocaleDateString()}</td>
                          <td className="admin-table-actions">
                            <button
                              type="button"
                              className="admin-icon-btn danger"
                              onClick={() => handleRemoveMember(m)}
                              disabled={removingUserId === m.user_id}
                              aria-label="Remove member"
                            >
                              <IconTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeSection === "requests" && (
            <>
              <div className="admin-toolbar" style={{ marginTop: 20 }}>
                <h2 className="section-title" style={{ fontSize: "1.05rem" }}>Join requests</h2>
                {pendingRequests.length > 0 && <span className="badge">{pendingRequests.length} pending</span>}
              </div>

              {pendingRequests.length === 0 ? (
                <p className="status-text">No pending join requests.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Requested</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((r) => (
                        <tr key={r.id}>
                          <td>{cellValue(r.user_name)}</td>
                          <td>{cellValue(r.user_email)}</td>
                          <td>{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="admin-table-actions">
                            <button
                              type="button"
                              className="admin-icon-btn success"
                              onClick={() => handleRespond(r, "approved")}
                              disabled={respondingId === r.id}
                              aria-label="Approve request"
                            >
                              <IconCheckCircle />
                            </button>
                            <button
                              type="button"
                              className="admin-icon-btn danger"
                              onClick={() => handleRespond(r, "rejected")}
                              disabled={respondingId === r.id}
                              aria-label="Reject request"
                            >
                              <IconX />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {formOpen && <RunForm onSave={handleAddRun} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
