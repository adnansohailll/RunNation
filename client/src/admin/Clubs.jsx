import { useState, useEffect, useCallback } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { useToast } from "../toast/useToast.js";
import { IconEdit, IconTrash, IconPlus, IconSearch, IconUsers } from "../icons.jsx";
import ClubForm from "./ClubForm.jsx";
import ClubAdmins from "./ClubAdmins.jsx";
import "../auth/auth.css";
import "./admin.css";

export default function Clubs() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingClub, setEditingClub] = useState(null);
  const [adminsClub, setAdminsClub] = useState(null);

  const loadClubs = useCallback((search = "") => {
    setLoading(true);
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/clubs${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load clubs"))))
      .then((data) => setClubs(data.clubs))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => loadClubs(search), 250);
    return () => clearTimeout(id);
  }, [search, loadClubs]);

  const openAdd = () => {
    setEditingClub(null);
    setFormOpen(true);
  };

  const openEdit = (club) => {
    setEditingClub(club);
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleSave = async (fields) => {
    if (editingClub) {
      await authFetch(`/api/clubs/${editingClub.id}`, token, {
        method: "PUT",
        body: JSON.stringify(fields),
      });
      showToast(`"${fields.name}" updated`);
    } else {
      await authFetch("/api/clubs", token, {
        method: "POST",
        body: JSON.stringify(fields),
      });
      showToast(`"${fields.name}" added`);
    }
    setFormOpen(false);
    loadClubs(search);
  };

  const handleDelete = async (club) => {
    if (!confirm(`Delete "${club.name}"? This cannot be undone.`)) return;
    try {
      await authFetch(`/api/clubs/${club.id}`, token, { method: "DELETE" });
      showToast(`"${club.name}" deleted`);
      loadClubs(search);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  };

  return (
    <div>
      <div className="admin-toolbar">
        <div className="auth-input-wrap admin-search">
          <IconSearch />
          <input
            type="text"
            className="auth-input"
            placeholder="Search clubs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="admin-btn-primary" onClick={openAdd}>
          <IconPlus /> Add club
        </button>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <p className="status-text loading">Loading clubs…</p>
      ) : clubs.length === 0 ? (
        <p className="status-text">No clubs found.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Contact</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((club) => (
                <tr key={club.id}>
                  <td>{club.name}</td>
                  <td>{club.location}</td>
                  <td>{club.contact_email || "—"}</td>
                  <td className="admin-table-actions">
                    <button type="button" className="admin-icon-btn" onClick={() => setAdminsClub(club)} aria-label="Manage admins">
                      <IconUsers />
                    </button>
                    <button type="button" className="admin-icon-btn" onClick={() => openEdit(club)} aria-label="Edit">
                      <IconEdit />
                    </button>
                    <button type="button" className="admin-icon-btn danger" onClick={() => handleDelete(club)} aria-label="Delete">
                      <IconTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && <ClubForm club={editingClub} onSave={handleSave} onClose={closeForm} />}
      {adminsClub && <ClubAdmins club={adminsClub} onClose={() => setAdminsClub(null)} />}
    </div>
  );
}
