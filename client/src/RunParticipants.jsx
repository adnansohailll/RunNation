import { useEffect, useState } from "react";
import { errorMessage } from "./utils.jsx";

/* ---- Read-only "N people going" count for a run occurrence, with the full
   name list on hover. Setting your own status now happens on the calendar
   above (RunCalendar); this just shows who else picked "I'm In". ---- */
export default function RunParticipants({ runId, date, refreshKey }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setState({ loading: true, error: null, data: null });
    const qs = date ? `?date=${date}` : "";
    fetch(`/api/runs/${runId}/participants${qs}`)
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      })
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err) =>
        setState({ loading: false, error: errorMessage(err, "Failed to load participants."), data: null })
      );
  }, [runId, date, refreshKey]);

  const { loading, error, data } = state;
  const hasParticipants = data && data.count > 0;

  return (
    <div className="run-participants">
      <h2 className="section-title" style={{ fontSize: "1.05rem" }}>Runners</h2>

      {loading && <p className="status-text loading">Loading runners…</p>}

      {!loading && error && <p className="run-participants-empty">Couldn't load runners.</p>}

      {!loading && !error && data && (
        <div
          className={`run-participants-count-wrap${hasParticipants ? " is-hoverable" : ""}`}
          onMouseEnter={() => hasParticipants && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span
            className="run-participants-count"
            tabIndex={hasParticipants ? 0 : undefined}
            onFocus={() => hasParticipants && setHovered(true)}
            onBlur={() => setHovered(false)}
          >
            {data.count}
          </span>
          <span className="run-participants-label">
            {data.count === 1 ? "runner in" : "runners in"}
          </span>

          {hasParticipants && hovered && (
            <div className="run-participants-popover">
              <ul className="run-participants-list">
                {data.participants.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
