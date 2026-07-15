import { useState } from "react";
import { IconX } from "../icons.jsx";
import { WEEKDAYS } from "../utils.jsx";
import "../auth/auth.css";
import "./admin.css";

const FIELDS = [
  { key: "meetup_location", label: "Meetup location", required: true },
  { key: "address_intersection", label: "Address / intersection" },
  { key: "start_times", label: "Start time (e.g. 6:00 PM)" },
  { key: "average_distance", label: "Distance (e.g. 3 to 5 Miles)" },
  { key: "terrain", label: "Terrain (e.g. Road, Trail)" },
  { key: "pace_groups", label: "Pace groups" },
];

export default function RunForm({ onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    weekday: "",
    ...Object.fromEntries(FIELDS.map((f) => [f.key, ""])),
  }));
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>Add run</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="run-weekday">Day *</label>
            <select
              id="run-weekday"
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
              <label className="auth-label" htmlFor={`run-${f.key}`}>
                {f.label}{f.required ? " *" : ""}
              </label>
              <input
                id={`run-${f.key}`}
                type="text"
                className="auth-input"
                style={{ paddingLeft: 12 }}
                value={form[f.key]}
                onChange={update(f.key)}
                required={f.required}
              />
            </div>
          ))}

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="auth-submit" style={{ width: "auto", padding: "10px 22px" }} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
