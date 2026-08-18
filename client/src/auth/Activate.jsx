import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import authBg from "../assets/images/login-page-bg.jpg";
import "./auth.css";

export default function Activate() {
  const { activate } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState(token ? "pending" : "missing");
  const [error, setError] = useState(null);
  // StrictMode/effect re-runs would otherwise consume the (single-use)
  // token twice, turning the second call into a false "invalid link" error.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    activate(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [token, activate]);

  return (
    <div className="auth-page" style={{ backgroundImage: `url(${authBg})` }}>
      <div className="auth-page-overlay" />
      <div className="container auth-wrap">
        <div className="auth-card">
          {status === "pending" && (
            <>
              <h1 className="auth-title">Activating your account…</h1>
              <p className="auth-subtitle">Hang tight, this only takes a second.</p>
            </>
          )}

          {status === "success" && (
            <>
              <h1 className="auth-title">You're all set!</h1>
              <p className="auth-subtitle">Your account is activated and you're logged in.</p>
              <Link to="/" className="auth-submit" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Go to RunNation
              </Link>
            </>
          )}

          {(status === "error" || status === "missing") && (
            <>
              <h1 className="auth-title">Activation link problem</h1>
              <div className="error-box" style={{ marginBottom: 16 }}>
                {status === "missing" ? "This link is missing its activation token." : error}
              </div>
              <p className="auth-switch">
                <Link to="/signup">Sign up again</Link> or <Link to="/login">log in</Link>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
