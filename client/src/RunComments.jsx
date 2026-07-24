import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, authFetch } from "./auth/useAuth.js";
import { IconImage, IconTrash, IconX } from "./icons.jsx";
import { compressImage, uploadAudioToCloudinary, uploadToCloudinary } from "./uploadMedia.js";
import PhotoGrid from "./PhotoGrid.jsx";
import PhotoLightbox from "./PhotoLightbox.jsx";
import VoiceRecorder from "./VoiceRecorder.jsx";
import VoiceNotePlayer from "./VoiceNotePlayer.jsx";

const MAX_PHOTOS = 10;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const formatOccurrenceDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });

let nextPhotoId = 0;

export default function RunComments({ runId, occurrenceDate }) {
  const { user, token } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [pendingVoiceNote, setPendingVoiceNote] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileInputRef = useRef(null);
  const activeAudioRef = useRef(null);

  const loadComments = useCallback(() => {
    setLoading(true);
    const url = `/api/runs/${runId}/comments${occurrenceDate ? `?date=${occurrenceDate}` : ""}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load comments"))))
      .then((data) => setComments(data.comments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [runId, occurrenceDate]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Revoke object URLs for any still-pending previews on unmount.
  useEffect(() => () => {
    pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    if (pendingVoiceNote) URL.revokeObjectURL(pendingVoiceNote.previewUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVoiceRecorded = ({ blob, duration }) => {
    if (pendingVoiceNote) URL.revokeObjectURL(pendingVoiceNote.previewUrl);
    setPendingVoiceNote({ blob, duration, previewUrl: URL.createObjectURL(blob) });
  };

  const removePendingVoiceNote = () => {
    if (!pendingVoiceNote) return;
    URL.revokeObjectURL(pendingVoiceNote.previewUrl);
    setPendingVoiceNote(null);
  };

  const addFiles = (files) => {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setPendingPhotos((current) => {
      const room = MAX_PHOTOS - current.length;
      if (room <= 0) {
        setError(`You can attach up to ${MAX_PHOTOS} photos.`);
        return current;
      }
      const accepted = images.slice(0, room);
      if (images.length > room) setError(`You can attach up to ${MAX_PHOTOS} photos.`);
      const added = accepted.map((file) => ({
        id: nextPhotoId++,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...current, ...added];
    });
  };

  const removePendingPhoto = (id) => {
    setPendingPhotos((current) => {
      const target = current.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((p) => p.id !== id);
    });
  };

  const handleFileInputChange = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  const handlePaste = (e) => {
    const items = [...e.clipboardData.items].filter((item) => item.type.startsWith("image/"));
    if (items.length === 0) return;
    addFiles(items.map((item) => item.getAsFile()).filter(Boolean));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim() && pendingPhotos.length === 0 && !pendingVoiceNote) return;
    setError(null);

    let photoUrls = [];
    let voiceNoteUrl = null;
    if (pendingPhotos.length > 0 || pendingVoiceNote) {
      setUploading(true);
      try {
        [photoUrls, voiceNoteUrl] = await Promise.all([
          Promise.all(pendingPhotos.map(async (p) => uploadToCloudinary(await compressImage(p.file)))),
          pendingVoiceNote ? uploadAudioToCloudinary(pendingVoiceNote.blob) : Promise.resolve(null),
        ]);
      } catch (err) {
        setError(err.message);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    setSubmitting(true);
    try {
      const data = await authFetch(`/api/runs/${runId}/comments`, token, {
        method: "POST",
        body: JSON.stringify({
          body,
          occurrence_date: occurrenceDate ?? null,
          photo_urls: photoUrls,
          voice_note_url: voiceNoteUrl,
          voice_note_duration: voiceNoteUrl ? pendingVoiceNote.duration : null,
        }),
      });
      setComments((cs) => [...cs, data.comment]);
      setBody("");
      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPendingPhotos([]);
      removePendingVoiceNote();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    setError(null);
    try {
      await authFetch(`/api/runs/${runId}/comments/${commentId}`, token, { method: "DELETE" });
      setComments((cs) => cs.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err.message);
    }
  };

  const busy = submitting || uploading;

  return (
    <div className="comments-section">
      <h2 className="section-title" style={{ fontSize: "1.05rem" }}>
        {occurrenceDate ? `Comments for ${formatOccurrenceDate(occurrenceDate)}` : "Comments"}
        {comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>

      {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}

      {token ? (
        <form
          className={`comment-form${dragActive ? " comment-dropzone-active" : ""}`}
          onSubmit={handleSubmit}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          {pendingPhotos.length > 0 && (
            <div className="comment-photo-preview-strip">
              {pendingPhotos.map((p) => (
                <div key={p.id} className="comment-photo-preview-item">
                  <img src={p.previewUrl} alt="" />
                  <button
                    type="button"
                    className="comment-photo-preview-remove"
                    onClick={() => removePendingPhoto(p.id)}
                    aria-label="Remove photo"
                  >
                    <IconX />
                  </button>
                </div>
              ))}
            </div>
          )}

          {pendingVoiceNote && (
            <div className="comment-voice-preview">
              <VoiceNotePlayer
                src={pendingVoiceNote.previewUrl}
                duration={pendingVoiceNote.duration}
                activeAudioRef={activeAudioRef}
              />
              <button
                type="button"
                className="comment-voice-preview-remove"
                onClick={removePendingVoiceNote}
                aria-label="Remove voice note"
              >
                <IconX />
              </button>
            </div>
          )}

          <textarea
            className="comment-textarea"
            placeholder="Share a tip, ask a question, or leave a note for this run…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={handlePaste}
            rows={3}
          />

          <div className="comment-form-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleFileInputChange}
            />
            <div className="comment-form-attach-actions">
              <button
                type="button"
                className="comment-photo-picker-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Add photos"
                title="Add photos"
              >
                <IconImage />
              </button>

              {!pendingVoiceNote && (
                <VoiceRecorder onRecorded={handleVoiceRecorded} onError={setError} />
              )}
            </div>

            <button
              type="submit"
              className="comment-submit-btn"
              disabled={busy || (!body.trim() && pendingPhotos.length === 0 && !pendingVoiceNote)}
            >
              {uploading ? "Uploading…" : submitting ? "Posting…" : "Post comment"}
            </button>
          </div>
        </form>
      ) : (
        <p className="status-text comment-login-prompt">
          <Link to="/login">Log in</Link> to leave a comment.
        </p>
      )}

      {loading ? (
        <p className="status-text loading">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="status-text">No comments yet — be the first to leave one.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <div className="comment-item-header">
                <span className="comment-author">{c.user_name || "Anonymous"}</span>
                <span className="comment-date">{formatDate(c.created_at)}</span>
                {user && (user.id === c.user_id || user.role === "super_admin") && (
                  <button
                    type="button"
                    className="comment-delete-btn"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Delete comment"
                  >
                    <IconTrash />
                  </button>
                )}
              </div>
              {c.body && <p className="comment-body">{c.body}</p>}
              {c.photo_urls?.length > 0 && (
                <PhotoGrid
                  photos={c.photo_urls}
                  onOpen={(index) => setLightbox({ photos: c.photo_urls, index })}
                />
              )}
              {c.voice_note_url && (
                <VoiceNotePlayer
                  src={c.voice_note_url}
                  duration={c.voice_note_duration}
                  activeAudioRef={activeAudioRef}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
