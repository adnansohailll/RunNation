import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import RunGroupDashboard from "./RunGroupDashboard.jsx";
import "./admin.css";

// /admin's index route: super admins land on the Run Groups tab; run group
// admins don't have sub-routes, so there's nowhere to redirect them to.
export function AdminIndex() {
  const { user } = useAuth();
  if (user?.role === "super_admin") return <Navigate to="run-groups" replace />;
  return null;
}

export default function AdminLayout() {
  const { user } = useAuth();

  if (user?.role !== "super_admin") {
    return (
      <div className="container admin-wrap">
        <div className="section-header">
          <h1 className="section-title">My Run Group</h1>
        </div>
        <RunGroupDashboard />
      </div>
    );
  }

  return (
    <div className="container admin-wrap">
      <div className="section-header">
        <h1 className="section-title">Admin</h1>
      </div>

      <nav className="admin-tabs">
        <NavLink to="run-groups" className={({ isActive }) => `admin-tab${isActive ? " active" : ""}`}>
          Run Groups
        </NavLink>
        <NavLink to="users" className={({ isActive }) => `admin-tab${isActive ? " active" : ""}`}>
          Users
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
