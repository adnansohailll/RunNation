import { useState, useEffect } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { useToast } from "../toast/useToast.js";
import { IconX, IconSearch, IconUserPlus } from "../icons.jsx";
import "../auth/auth.css";
import "./admin.css";

export default function UserClubs({ user, onClose, onChange }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [clubs, setClubs] = useState(user.clubs);
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
      fetch(`/api/clubs?search=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to search clubs"))))
        .then((data) => setResults(data.clubs))
        .catch((err) => setError(err.message))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  const clubIds = new Set(clubs.map((c) => c.id));
  const candidates = results.filter((c) => !clubIds.has(c.id));

  const addClub = async (club) => {
    setError(null);
    setAdding(club.id);
    try {
      await authFetch(`/api/clubs/${club.id}/admins`, token, {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      setClubs((cs) => [...cs, { id: club.id, name: club.name }]);
      setSearch("");
      setResults([]);
      showToast(`${user.name || user.email} added as admin of "${club.name}"`);
      onChange?.();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setAdding(null);
    }
  };

  const removeClub = async (clubId, clubName) => {
    setError(null);
    setRemoving(clubId);
    try {
      await authFetch(`/api/clubs/${clubId}/admins/${user.id}`, token, { method: "DELETE" });
      setClubs((cs) => cs.filter((c) => c.id !== clubId));
      showToast(`${user.name || user.email} removed as admin of "${clubName}"`);
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
          <h2>Clubs — {user.name || user.email}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="auth-field">
          <label className="auth-label">Assign club</label>
          <div className="auth-input-wrap">
            <IconSearch />
            <input
              type="text"
              className="auth-input"
              placeholder="Search clubs by name or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search.trim() && (
            <div className="admin-search-results">
              {searching ? (
                <p className="admin-search-empty">Searching…</p>
              ) : candidates.length === 0 ? (
                <p className="admin-search-empty">No matching clubs.</p>
              ) : (
                candidates.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="admin-search-result"
                    onClick={() => addClub(c)}
                    disabled={adding === c.id}
                  >
                    <span>
                      <strong>{c.name}</strong>
                      <span className="admin-search-result-email">{c.location}</span>
                    </span>
                    <IconUserPlus />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-label">Current clubs</label>
          {clubs.length === 0 ? (
            <p className="admin-chip-empty">Not assigned to any club yet.</p>
          ) : (
            <ul className="admin-admin-list">
              {clubs.map((c) => (
                <li key={c.id} className="admin-admin-list-item">
                  <span><strong>{c.name}</strong></span>
                  <button
                    type="button"
                    className="admin-icon-btn danger"
                    onClick={() => removeClub(c.id, c.name)}
                    disabled={removing === c.id}
                    aria-label={`Remove ${c.name}`}
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
