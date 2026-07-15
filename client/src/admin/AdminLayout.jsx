import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import ClubDashboard from "./ClubDashboard.jsx";
import "./admin.css";

// /admin's index route: super admins land on the Clubs tab; club admins
// don't have sub-routes, so there's nowhere to redirect them to.
export function AdminIndex() {
  const { user } = useAuth();
  if (user?.role === "super_admin") return <Navigate to="clubs" replace />;
  return null;
}

export default function AdminLayout() {
  const { user } = useAuth();

  if (user?.role !== "super_admin") {
    return (
      <div className="container admin-wrap">
        <div className="section-header">
          <h1 className="section-title">My Club</h1>
        </div>
        <ClubDashboard />
      </div>
    );
  }

  return (
    <div className="container admin-wrap">
      <div className="section-header">
        <h1 className="section-title">Admin</h1>
      </div>

      <nav className="admin-tabs">
        <NavLink to="clubs" className={({ isActive }) => `admin-tab${isActive ? " active" : ""}`}>
          Clubs
        </NavLink>
        <NavLink to="users" className={({ isActive }) => `admin-tab${isActive ? " active" : ""}`}>
          Users
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
