import { useState, useEffect, useCallback } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { useToast } from "../toast/useToast.js";
import { IconEdit, IconTrash, IconPlus, IconSearch, IconUsers } from "../icons.jsx";
import RunGroupForm from "./RunGroupForm.jsx";
import RunGroupAdmins from "./RunGroupAdmins.jsx";
import "../auth/auth.css";
import "./admin.css";

export default function RunGroups() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [runGroups, setRunGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRunGroup, setEditingRunGroup] = useState(null);
  const [adminsRunGroup, setAdminsRunGroup] = useState(null);

  const loadRunGroups = useCallback((search = "") => {
    setLoading(true);
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/run-groups${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load run groups"))))
      .then((data) => setRunGroups(data.runGroups))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => loadRunGroups(search), 250);
    return () => clearTimeout(id);
  }, [search, loadRunGroups]);

  const openAdd = () => {
    setEditingRunGroup(null);
    setFormOpen(true);
  };

  const openEdit = (runGroup) => {
    setEditingRunGroup(runGroup);
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleSave = async (fields) => {
    if (editingRunGroup) {
      await authFetch(`/api/run-groups/${editingRunGroup.id}`, token, {
        method: "PUT",
        body: JSON.stringify(fields),
      });
      showToast(`"${fields.name}" updated`);
    } else {
      await authFetch("/api/run-groups", token, {
        method: "POST",
        body: JSON.stringify(fields),
      });
      showToast(`"${fields.name}" added`);
    }
    setFormOpen(false);
    loadRunGroups(search);
  };

  const handleDelete = async (runGroup) => {
    if (!confirm(`Delete "${runGroup.name}"? This cannot be undone.`)) return;
    try {
      await authFetch(`/api/run-groups/${runGroup.id}`, token, { method: "DELETE" });
      showToast(`"${runGroup.name}" deleted`);
      loadRunGroups(search);
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
            placeholder="Search run groups…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="admin-btn-primary" onClick={openAdd}>
          <IconPlus /> Add run group
        </button>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <p className="status-text loading">Loading run groups…</p>
      ) : runGroups.length === 0 ? (
        <p className="status-text">No run groups found.</p>
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
              {runGroups.map((runGroup) => (
                <tr key={runGroup.id}>
                  <td>{runGroup.name}</td>
                  <td>{runGroup.location}</td>
                  <td>{runGroup.contact_email || "—"}</td>
                  <td className="admin-table-actions">
                    <button type="button" className="admin-icon-btn" onClick={() => setAdminsRunGroup(runGroup)} aria-label="Manage admins">
                      <IconUsers />
                    </button>
                    <button type="button" className="admin-icon-btn" onClick={() => openEdit(runGroup)} aria-label="Edit">
                      <IconEdit />
                    </button>
                    <button type="button" className="admin-icon-btn danger" onClick={() => handleDelete(runGroup)} aria-label="Delete">
                      <IconTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && <RunGroupForm runGroup={editingRunGroup} onSave={handleSave} onClose={closeForm} />}
      {adminsRunGroup && <RunGroupAdmins runGroup={adminsRunGroup} onClose={() => setAdminsRunGroup(null)} />}
    </div>
  );
}
