import { useState, useRef } from "react";
import { IconX, IconImage } from "../icons.jsx";
import "../auth/auth.css";
import "./admin.css";

const FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "description", label: "Description", required: true, textarea: true },
  { key: "location", label: "Location", required: true },
  { key: "contact_email", label: "Contact email" },
  { key: "contact_phone", label: "Contact phone" },
  { key: "website", label: "Website" },
];

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export default function ClubForm({ club, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, club?.[f.key] ?? ""]))
  );
  const [logo, setLogo] = useState(club?.logo_url ?? "");
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
      await onSave({ ...form, logo_url: logo });
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
          <h2>{club ? "Edit club" : "Add club"}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">Club logo/banner</label>
            <div className="admin-logo-upload">
              {logo ? (
                <div className="admin-logo-preview">
                  <img src={logo} alt="Club logo/banner preview" />
                  <button type="button" className="admin-logo-remove" onClick={removeLogo} aria-label="Remove logo/banner">
                    <IconX />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="admin-logo-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
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
              <label className="auth-label" htmlFor={`club-${f.key}`}>
                {f.label}{f.required ? " *" : ""}
              </label>
              {f.textarea ? (
                <textarea
                  id={`club-${f.key}`}
                  className="admin-textarea"
                  value={form[f.key]}
                  onChange={update(f.key)}
                  required={f.required}
                  rows={3}
                />
              ) : (
                <input
                  id={`club-${f.key}`}
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
