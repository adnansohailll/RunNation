import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, authFetch } from "./auth/useAuth.js";
import { errorMessage } from "./utils.jsx";

/* ---- "2026-08-04" -> "Tue, Aug 4" — short enough to sit inside the button
   alongside the label, but still names which occurrence it addresses. ---- */
const formatShortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });

/* ---- RSVP widget for a single run occurrence — the next upcoming one by
   default, or whichever date is selected on the calendar above it. Future
   occurrences get a toggle button + live count; past ones are count-only,
   since attendance can no longer change. ---- */
export default function RunAttendance({ runId, date }) {
  const { token } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    setState({ loading: true, error: null, data: null });
    const qs = date ? `?date=${date}` : "";
    fetch(`/api/runs/${runId}/attendance${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      })
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err) =>
        setState({ loading: false, error: errorMessage(err, "Failed to load attendance."), data: null })
      );
  }, [runId, date, token]);

  const toggle = async () => {
    if (!state.data || toggling) return;
    setToggling(true);
    try {
      const result = await authFetch(`/api/runs/${runId}/attendance`, token, {
        method: "POST",
        body: JSON.stringify({ date: state.data.date }),
      });
      setState((s) => ({ ...s, data: result }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setToggling(false);
    }
  };

  const { loading, error, data } = state;

  return (
    <div className="run-attendance">
      <h2 className="section-title" style={{ fontSize: "1.05rem" }}>Participants</h2>

      {loading && <p className="status-text loading">Loading participants…</p>}

      {!loading && error && <p className="run-attendance-empty">Couldn't load participants.</p>}

      {!loading && !error && data && (
        <div className="run-attendance-body">
          {data.isFuture && (
            token ? (
              <button
                type="button"
                className={`run-attendance-btn${data.attending ? " is-joined" : ""}`}
                onClick={toggle}
                disabled={toggling}
              >
                {data.attending ? "✓ " : ""}I'm in — {formatShortDate(data.date)}
              </button>
            ) : (
              <Link to="/login" className="run-attendance-login-link">
                Log in to join — {formatShortDate(data.date)}
              </Link>
            )
          )}

          <span className="run-attendance-count">{data.count}</span>
        </div>
      )}
    </div>
  );
}
