import { useState, useEffect, useCallback } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { useToast } from "../toast/useToast.js";
import { WEEKDAYS } from "../utils.jsx";
import "../auth/auth.css";
import "../admin/admin.css";

// Nav-linked for super admins only (see App.jsx), but still reachable by
// permalink for any logged-in user: /data-entry/runs
// Stages a row in run_metadata_data_entry, linked to a run_group_data_entry
// row. Only groups added through the run-group data-entry form show up in
// the picker below — live run_groups are not queried here.

const FIELDS = [
  { key: "meetup_location", label: "Meetup location", required: true },
  { key: "address_intersection", label: "Address / intersection" },
  { key: "start_times", label: "Start time (24-hour)", type: "time" },
  { key: "average_distance", label: "Distance (e.g. 3 to 5 Miles)" },
  { key: "terrain", label: "Terrain (e.g. Road, Trail)" },
  { key: "pace_groups", label: "Pace groups", defaultValue: "All levels welcome" },
];

const EMPTY_FORM = {
  run_group_id: "",
  weekday: "",
  ...Object.fromEntries(FIELDS.map((f) => [f.key, f.defaultValue ?? ""])),
};

export default function RunDataEntry() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [runGroups, setRunGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRunGroups = useCallback(() => {
    setLoadingGroups(true);
    authFetch("/api/data-entry/run-groups", token)
      .then((data) => setRunGroups(data.runGroups))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingGroups(false));
  }, [token]);

  useEffect(() => {
    loadRunGroups();
  }, [loadRunGroups]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authFetch("/api/data-entry/runs", token, {
        method: "POST",
        body: JSON.stringify(form),
      });
      showToast("Run staged for review");
      setForm((f) => ({ ...EMPTY_FORM, run_group_id: f.run_group_id }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container admin-wrap">
      <div className="section-header">
        <h1 className="section-title">Run — Data Entry</h1>
      </div>
      <p className="status-text" style={{ marginBottom: 20 }}>
        Submissions here are staged for review and aren't shown anywhere on the site until
        someone moves them into the live runs. Only run groups added via the run-group data
        entry form show up below.
      </p>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {loadingGroups ? (
        <p className="status-text loading">Loading staged run groups…</p>
      ) : runGroups.length === 0 ? (
        <p className="status-text">
          No staged run groups yet — add one on the run-group data entry page first.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="run-data-entry-group">Run group *</label>
            <select
              id="run-data-entry-group"
              className="auth-input"
              style={{ paddingLeft: 12 }}
              value={form.run_group_id}
              onChange={update("run_group_id")}
              required
            >
              <option value="">Choose a run group…</option>
              {runGroups.map((rg) => (
                <option key={rg.id} value={rg.id}>{rg.name}</option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="run-data-entry-weekday">Day *</label>
            <select
              id="run-data-entry-weekday"
              className="auth-input"
              style={{ paddingLeft: 12 }}
              value={form.weekday}
              onChange={update("weekday")}
              required
            >
              <option value="">Choose a day…</option>
              {WEEKDAYS.map((d) => (
                <option key={d.full} value={d.full}>{d.full}</option>
              ))}
            </select>
          </div>

          {FIELDS.map((f) => (
            <div className="auth-field" key={f.key}>
              <label className="auth-label" htmlFor={`run-data-entry-${f.key}`}>
                {f.label}{f.required ? " *" : ""}
              </label>
              <input
                id={`run-data-entry-${f.key}`}
                type={f.type || "text"}
                className="auth-input"
                style={{ paddingLeft: 12 }}
                value={form[f.key]}
                onChange={update(f.key)}
                required={f.required}
              />
            </div>
          ))}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "Saving…" : "Add run"}
          </button>
        </form>
      )}
    </div>
  );
}
