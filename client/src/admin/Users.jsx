import { useState, useEffect, useCallback } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { IconSearch, IconUsers } from "../icons.jsx";
import UserClubs from "./UserClubs.jsx";
import "../auth/auth.css";
import "./admin.css";

function RoleBadge({ role }) {
  return <span className={`admin-role-badge role-${role}`}>{role.replace("_", " ")}</span>;
}

export default function Users() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [managingUser, setManagingUser] = useState(null);

  const loadUsers = useCallback((search = "") => {
    setLoading(true);
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    authFetch(`/api/users${qs}`, token)
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const id = setTimeout(() => loadUsers(search), 250);
    return () => clearTimeout(id);
  }, [search, loadUsers]);

  return (
    <div>
      <div className="admin-toolbar">
        <div className="auth-input-wrap admin-search">
          <IconSearch />
          <input
            type="text"
            className="auth-input"
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <p className="status-text loading">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="status-text">No users found.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Clubs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || "—"}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || "—"}</td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>
                    <div className="admin-chip-row">
                      {u.clubs.map((c) => (
                        <span className="admin-chip admin-chip-static" key={c.id}>{c.name}</span>
                      ))}
                      {u.clubs.length === 0 && <span className="admin-chip-empty">None</span>}
                    </div>
                  </td>
                  <td className="admin-table-actions">
                    {u.role !== "super_admin" && (
                      <button type="button" className="admin-icon-btn" onClick={() => setManagingUser(u)} aria-label="Manage clubs">
                        <IconUsers />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {managingUser && (
        <UserClubs
          user={managingUser}
          onClose={() => setManagingUser(null)}
          onChange={() => loadUsers(search)}
        />
      )}
    </div>
  );
}
