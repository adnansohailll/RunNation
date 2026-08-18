import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { IconUser, IconMail, IconPhone, IconLock } from "../icons.jsx";
import authBg from "../assets/images/login-page-bg.jpg";
import "./auth.css";

export default function Signup() {
  const { signup, resendActivation } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Set to the signed-up email once signup succeeds — swaps the form out
  // for a "check your email" confirmation instead of navigating away,
  // since the account isn't usable until the activation link is clicked.
  const [confirmedEmail, setConfirmedEmail] = useState(null);
  const [resendState, setResendState] = useState("idle"); // idle | sending | sent

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const data = await signup(form);
      setConfirmedEmail(data.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResendState("sending");
    try {
      await resendActivation(confirmedEmail);
    } finally {
      setResendState("sent");
    }
  };

  if (confirmedEmail) {
    return (
      <div className="auth-page" style={{ backgroundImage: `url(${authBg})` }}>
        <div className="auth-page-overlay" />
        <div className="container auth-wrap">
          <div className="auth-card">
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">
              We sent an activation link to <strong>{confirmedEmail}</strong>. Click it to activate your account, then log in.
            </p>

            <p className="auth-switch">
              Didn't get it?{" "}
              {resendState === "sent" ? (
                "Sent again — check your inbox."
              ) : (
                <button type="button" className="auth-link-btn" onClick={handleResend} disabled={resendState === "sending"}>
                  {resendState === "sending" ? "Sending…" : "Resend the email"}
                </button>
              )}
            </p>

            <p className="auth-switch">
              <Link to="/login">Back to log in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

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
                  pattern="(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                  title="At least 8 characters, including one uppercase letter, one number, and one special character"
                  autoComplete="new-password"
                />
              </div>
              <p className="auth-field-hint">
                At least 8 characters, with one uppercase letter, one number, and one special character.
              </p>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-confirm-password">Confirm password</label>
              <div className="auth-input-wrap">
                <IconLock />
                <input
                  id="signup-confirm-password"
                  type="password"
                  className="auth-input"
                  value={form.confirmPassword}
                  onChange={update("confirmPassword")}
                  required
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
