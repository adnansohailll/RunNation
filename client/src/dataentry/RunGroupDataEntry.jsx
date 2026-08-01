import { useState, useRef } from "react";
import { useAuth, authFetch } from "../auth/useAuth.js";
import { useToast } from "../toast/useToast.js";
import { IconImage, IconX } from "../icons.jsx";
import "../auth/auth.css";
import "../admin/admin.css";

// Nav-linked for super admins only (see App.jsx), but still reachable by
// permalink for any logged-in user: /data-entry/run-groups
// Stages a row in run_groups_data_entry. Nothing here touches the live
// run_groups table; someone moves staged rows over by hand later.

const FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "description", label: "Description", required: true, textarea: true },
  { key: "location", label: "Location", required: true },
  { key: "contact_email", label: "Contact email" },
  { key: "contact_phone", label: "Contact phone" },
  { key: "website", label: "Website" },
];

const EMPTY_FORM = Object.fromEntries(FIELDS.map((f) => [f.key, ""]));
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export default function RunGroupDataEntry() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [logo, setLogo] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo image must be smaller than 2MB.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => setLogo("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await authFetch("/api/data-entry/run-groups", token, {
        method: "POST",
        body: JSON.stringify({ ...form, logo_url: logo }),
      });
      showToast(`"${data.runGroup.name}" staged for review`);
      setForm(EMPTY_FORM);
      setLogo("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container admin-wrap">
      <div className="section-header">
        <h1 className="section-title">Run Group — Data Entry</h1>
      </div>
      <p className="status-text" style={{ marginBottom: 20 }}>
        Submissions here are staged for review and aren't shown anywhere on the site until
        someone moves them into the live run groups.
      </p>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
        <div className="auth-field">
          <label className="auth-label">Run group logo/banner</label>
          <div className="admin-logo-upload">
            {logo ? (
              <div className="admin-logo-preview">
                <img src={logo} alt="Run group logo/banner preview" />
                <button type="button" className="admin-logo-remove" onClick={removeLogo} aria-label="Remove logo/banner">
                  <IconX />
                </button>
              </div>
            ) : (
              <button type="button" className="admin-logo-dropzone" onClick={() => fileInputRef.current?.click()}>
                <IconImage />
                <span>Upload image</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="admin-logo-input"
              onChange={handleLogoChange}
            />
          </div>
        </div>

        {FIELDS.map((f) => (
          <div className="auth-field" key={f.key}>
            <label className="auth-label" htmlFor={`rg-data-entry-${f.key}`}>
              {f.label}{f.required ? " *" : ""}
            </label>
            {f.textarea ? (
              <textarea
                id={`rg-data-entry-${f.key}`}
                className="admin-textarea"
                value={form[f.key]}
                onChange={update(f.key)}
                required={f.required}
                rows={3}
              />
            ) : (
              <input
                id={`rg-data-entry-${f.key}`}
                type="text"
                className="auth-input"
                style={{ paddingLeft: 12 }}
                value={form[f.key]}
                onChange={update(f.key)}
                required={f.required}
              />
            )}
          </div>
        ))}

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Saving…" : "Add run group"}
        </button>
      </form>
    </div>
  );
}
