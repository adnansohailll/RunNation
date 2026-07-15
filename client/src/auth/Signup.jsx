import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { IconUser, IconMail, IconPhone, IconLock } from "../icons.jsx";
import authBg from "../assets/images/login-page-bg.jpg";
import "./auth.css";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(form);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page" style={{ backgroundImage: `url(${authBg})` }}>
      <div className="auth-page-overlay" />
      <div className="container auth-wrap">
        <div className="auth-card">
          <h1 className="auth-title">Create an account</h1>
          <p className="auth-subtitle">Sign up to join runs and follow your favorite clubs.</p>

          {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-name">Name</label>
              <div className="auth-input-wrap">
                <IconUser />
                <input
                  id="signup-name"
                  type="text"
                  className="auth-input"
                  value={form.name}
                  onChange={update("name")}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-email">Email</label>
              <div className="auth-input-wrap">
                <IconMail />
                <input
                  id="signup-email"
                  type="email"
                  className="auth-input"
                  value={form.email}
                  onChange={update("email")}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-phone">Phone (optional)</label>
              <div className="auth-input-wrap">
                <IconPhone />
                <input
                  id="signup-phone"
                  type="tel"
                  className="auth-input"
                  value={form.phone}
                  onChange={update("phone")}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-password">Password</label>
              <div className="auth-input-wrap">
                <IconLock />
                <input
                  id="signup-password"
                  type="password"
                  className="auth-input"
                  value={form.password}
                  onChange={update("password")}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? "Signing up…" : "Sign up"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
