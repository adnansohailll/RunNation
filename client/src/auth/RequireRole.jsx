import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth.js";

// Route guard: redirects to /login if unauthenticated, or to / if
// authenticated but the user's role isn't in `roles`.
export default function RequireRole({ roles }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
