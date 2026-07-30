import { useState, useEffect } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { useToast } from "../toast/useToast.js";
import { IconX, IconSearch, IconUserPlus } from "../icons.jsx";
import "../auth/auth.css";
import "./admin.css";

export default function UserRunGroups({ user, onClose, onChange }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [runGroups, setRunGroups] = useState(user.runGroups);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setResults([]);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      fetch(`/api/run-groups?search=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to search run groups"))))
        .then((data) => setResults(data.runGroups))
        .catch((err) => setError(err.message))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  const runGroupIds = new Set(runGroups.map((rg) => rg.id));
  const candidates = results.filter((rg) => !runGroupIds.has(rg.id));

  const addRunGroup = async (runGroup) => {
    setError(null);
    setAdding(runGroup.id);
    try {
      await authFetch(`/api/run-groups/${runGroup.id}/admins`, token, {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      setRunGroups((rgs) => [...rgs, { id: runGroup.id, name: runGroup.name }]);
      setSearch("");
      setResults([]);
      showToast(`${user.name || user.email} added as admin of "${runGroup.name}"`);
      onChange?.();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setAdding(null);
    }
  };

  const removeRunGroup = async (runGroupId, runGroupName) => {
    setError(null);
    setRemoving(runGroupId);
    try {
      await authFetch(`/api/run-groups/${runGroupId}/admins/${user.id}`, token, { method: "DELETE" });
      setRunGroups((rgs) => rgs.filter((rg) => rg.id !== runGroupId));
      showToast(`${user.name || user.email} removed as admin of "${runGroupName}"`);
      onChange?.();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>Run Groups — {user.name || user.email}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="auth-field">
          <label className="auth-label">Assign run group</label>
          <div className="auth-input-wrap">
            <IconSearch />
            <input
              type="text"
              className="auth-input"
              placeholder="Search run groups by name or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search.trim() && (
            <div className="admin-search-results">
              {searching ? (
                <p className="admin-search-empty">Searching…</p>
              ) : candidates.length === 0 ? (
                <p className="admin-search-empty">No matching run groups.</p>
              ) : (
                candidates.map((rg) => (
                  <button
                    type="button"
                    key={rg.id}
                    className="admin-search-result"
                    onClick={() => addRunGroup(rg)}
                    disabled={adding === rg.id}
                  >
                    <span>
                      <strong>{rg.name}</strong>
                      <span className="admin-search-result-email">{rg.location}</span>
                    </span>
                    <IconUserPlus />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-label">Current run groups</label>
          {runGroups.length === 0 ? (
            <p className="admin-chip-empty">Not assigned to any run group yet.</p>
          ) : (
            <ul className="admin-admin-list">
              {runGroups.map((rg) => (
                <li key={rg.id} className="admin-admin-list-item">
                  <span><strong>{rg.name}</strong></span>
                  <button
                    type="button"
                    className="admin-icon-btn danger"
                    onClick={() => removeRunGroup(rg.id, rg.name)}
                    disabled={removing === rg.id}
                    aria-label={`Remove ${rg.name}`}
                  >
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
