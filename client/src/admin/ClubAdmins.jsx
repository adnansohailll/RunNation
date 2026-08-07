import { useState, useEffect, useCallback } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { useToast } from "../toast/useToast.js";
import { IconX, IconSearch, IconUserPlus } from "../icons.jsx";
import "../auth/auth.css";
import "./admin.css";

export default function ClubAdmins({ club, onClose }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);

  const loadAdmins = useCallback(() => {
    setLoading(true);
    authFetch(`/api/clubs/${club.id}/admins`, token)
      .then((data) => setAdmins(data.admins))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [club.id, token]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setResults([]);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      authFetch(`/api/users?search=${encodeURIComponent(query)}`, token)
        .then((data) => setResults(data.users))
        .catch((err) => setError(err.message))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(id);
  }, [search, token]);

  const adminIds = new Set(admins.map((a) => a.id));
  const candidates = results.filter((u) => u.role !== "super_admin" && !adminIds.has(u.id));

  const addAdmin = async (userId, userLabel) => {
    setError(null);
    setAdding(userId);
    try {
      const data = await authFetch(`/api/clubs/${club.id}/admins`, token, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setAdmins(data.admins);
      setSearch("");
      setResults([]);
      showToast(`${userLabel} added as admin of "${club.name}"`);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setAdding(null);
    }
  };

  const removeAdmin = async (userId, userLabel) => {
    setError(null);
    try {
      const data = await authFetch(`/api/clubs/${club.id}/admins/${userId}`, token, { method: "DELETE" });
      setAdmins(data.admins);
      showToast(`${userLabel} removed as admin of "${club.name}"`);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>Admins — {club.name}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="auth-field">
          <label className="auth-label">Add admin</label>
          <div className="auth-input-wrap">
            <IconSearch />
            <input
              type="text"
              className="auth-input"
              placeholder="Search users by name, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search.trim() && (
            <div className="admin-search-results">
              {searching ? (
                <p className="admin-search-empty">Searching…</p>
              ) : candidates.length === 0 ? (
                <p className="admin-search-empty">No matching users.</p>
              ) : (
                candidates.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    className="admin-search-result"
                    onClick={() => addAdmin(u.id, u.name || u.email)}
                    disabled={adding === u.id}
                  >
                    <span>
                      <strong>{u.name || u.email}</strong>
                      {u.name && <span className="admin-search-result-email">{u.email}</span>}
                    </span>
                    <IconUserPlus />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-label">Current admins</label>
          {loading ? (
            <p className="status-text loading">Loading admins…</p>
          ) : admins.length === 0 ? (
            <p className="admin-chip-empty">No admins assigned yet.</p>
          ) : (
            <ul className="admin-admin-list">
              {admins.map((a) => (
                <li key={a.id} className="admin-admin-list-item">
                  <span>
                    <strong>{a.name || a.email}</strong>
                    {a.name && <span className="admin-search-result-email">{a.email}</span>}
                  </span>
                  <button type="button" className="admin-icon-btn danger" onClick={() => removeAdmin(a.id, a.name || a.email)} aria-label={`Remove ${a.name || a.email}`}>
                    <IconX />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-modal-actions">
          <button type="button" className="admin-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
