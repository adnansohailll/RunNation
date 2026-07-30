import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, authFetch } from "./auth/useAuth.js";
import { IconImage, IconThumbsUp, IconTrash, IconX } from "./icons.jsx";
import { compressImage, uploadAudioToCloudinary, uploadToCloudinary } from "./uploadMedia.js";
import PhotoGrid from "./PhotoGrid.jsx";
import PhotoLightbox from "./PhotoLightbox.jsx";
import VoiceRecorder from "./VoiceRecorder.jsx";
import VoiceNotePlayer from "./VoiceNotePlayer.jsx";

const MAX_PHOTOS = 10;
const PAGE_SIZE = 50;
const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const DEFAULT_REACTION = "👍";
const REACTION_LABELS = { "👍": "Like", "❤️": "Love", "😂": "Haha", "😮": "Wow", "😢": "Sad", "🙏": "Thankful" };

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const formatOccurrenceDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });

let nextPhotoId = 0;

/* ---- A single comment or reply — header, body, media, and the Facebook-
   style reaction/reply action row underneath. Used both for top-level
   comments and (in a more indented, text-only-composer context) replies. ---- */
function CommentRow({
  comment, isReply, token, user, onDelete, onOpenLightbox, activeAudioRef,
  openPickerId, setOpenPickerId, onToggleReaction,
  openReplyId, setOpenReplyId, replyBody, setReplyBody, onSubmitReply, replySubmitting,
}) {
  const reactions = comment.reactions || [];
  const pickerOpen = openPickerId === comment.id;
  const replyOpen = openReplyId === comment.id;

  return (
    <div className={`comment-item${isReply ? " comment-item-reply" : ""}`}>
      <div className="comment-item-header">
        <span className="comment-author">{comment.user_name || "Anonymous"}</span>
        <span className="comment-date">{formatDate(comment.created_at)}</span>
        {user && (user.id === comment.user_id || user.role === "super_admin") && (
          <button
            type="button"
            className="comment-delete-btn"
            onClick={() => onDelete(comment.id)}
            aria-label="Delete comment"
          >
            <IconTrash />
          </button>
        )}
      </div>
      {comment.body && <p className="comment-body">{comment.body}</p>}
      {comment.photo_urls?.length > 0 && (
        <PhotoGrid
          photos={comment.photo_urls}
          onOpen={(index) => onOpenLightbox({ photos: comment.photo_urls, index })}
        />
      )}
      {comment.voice_note_url && (
        <VoiceNotePlayer
          src={comment.voice_note_url}
          duration={comment.voice_note_duration}
          activeAudioRef={activeAudioRef}
        />
      )}

      <div className="comment-actions-row">
        {reactions.length > 0 && (
          <div className="comment-reaction-pills">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={`comment-reaction-pill${comment.myReaction === r.emoji ? " is-mine" : ""}`}
                onClick={() => onToggleReaction(comment.id, r.emoji)}
                disabled={!token}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        {token && (
          <div className="comment-action-links">
            <div
              className="comment-like-wrapper"
              onMouseEnter={() => setOpenPickerId(comment.id)}
              onMouseLeave={() => setOpenPickerId((id) => (id === comment.id ? null : id))}
            >
              {pickerOpen && (
                <div className="comment-emoji-picker">
                  {REACTION_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="comment-emoji-option"
                      onClick={() => onToggleReaction(comment.id, emoji)}
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                className={`comment-like-btn${comment.myReaction ? " is-reacted" : ""}`}
                onClick={() => onToggleReaction(comment.id, comment.myReaction || DEFAULT_REACTION)}
              >
                {comment.myReaction && comment.myReaction !== DEFAULT_REACTION ? (
                  <span className="comment-like-emoji" aria-hidden="true">{comment.myReaction}</span>
                ) : (
                  <IconThumbsUp />
                )}
                {REACTION_LABELS[comment.myReaction] || "Like"}
              </button>
            </div>

            <button
              type="button"
              className="comment-action-link"
              onClick={() => setOpenReplyId((id) => (id === comment.id ? null : comment.id))}
            >
              Reply
            </button>
          </div>
        )}
      </div>

      {replyOpen && (
        <form
          className="comment-reply-form"
          onSubmit={(e) => { e.preventDefault(); onSubmitReply(comment.id); }}
        >
          <input
            type="text"
            className="comment-reply-input"
            placeholder="Write a reply…"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="comment-reply-submit"
            disabled={replySubmitting || !replyBody.trim()}
          >
            {replySubmitting ? "Posting…" : "Reply"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function RunComments({ runId, occurrenceDate, onPosted, injectComment }) {
  const { user, token } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [pendingVoiceNote, setPendingVoiceNote] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [openPickerId, setOpenPickerId] = useState(null);
  const [openReplyId, setOpenReplyId] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const activeAudioRef = useRef(null);
  const sentinelRef = useRef(null);

  // Sent with a Bearer header (not authFetch, since a missing token here just
  // means an anonymous view, not an error) so optionalAuth can attach each
  // comment's myReaction for the current viewer.
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadComments = useCallback(() => {
    setLoading(true);
    const url = `/api/runs/${runId}/comments?limit=${PAGE_SIZE}${occurrenceDate ? `&date=${occurrenceDate}` : ""}`;
    fetch(url, { headers: authHeaders })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load comments"))))
      .then((data) => {
        setComments(data.comments);
        setHasMore(data.hasMore);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, occurrenceDate, token]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // The attendance widget (a sibling, not a child) auto-posts a comment when
  // someone joins a run and hands it up here so it appears immediately
  // instead of waiting for this list's next reload. Only prepend it if it
  // belongs to whichever occurrence is currently in view.
  useEffect(() => {
    if (!injectComment) return;
    if (occurrenceDate && injectComment.occurrence_date !== occurrenceDate) return;
    setComments((cs) => (cs.some((c) => c.id === injectComment.id) ? cs : [injectComment, ...cs]));
  }, [injectComment, occurrenceDate]);

  // Using the current comment count as the offset (rather than a separately
  // tracked page number) keeps this correct even if a comment was added or
  // deleted locally since the last page load.
  const loadMore = useCallback(() => {
    setLoadingMore(true);
    const url = `/api/runs/${runId}/comments?limit=${PAGE_SIZE}&offset=${comments.length}${occurrenceDate ? `&date=${occurrenceDate}` : ""}`;
    fetch(url, { headers: authHeaders })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load more comments"))))
      .then((data) => {
        setComments((cs) => [...cs, ...data.comments]);
        setHasMore(data.hasMore);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMore(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, occurrenceDate, comments.length, token]);

  // Fetch the next page once the sentinel below the list scrolls into view.
  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

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
          photo_urls: photoUrls,
          voice_note_url: voiceNoteUrl,
          voice_note_duration: voiceNoteUrl ? pendingVoiceNote.duration : null,
        }),
      });
      setComments((cs) => [data.comment, ...cs]);
      setBody("");
      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPendingPhotos([]);
      removePendingVoiceNote();
      // The comment is always bucketed to whichever occurrence is next as of
      // now, which may not be the thread currently filtered — let the parent
      // clear the filter so it's visible right away.
      onPosted?.();
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
      setComments((cs) => cs
        .filter((c) => c.id !== commentId)
        .map((c) => (c.replies?.some((r) => r.id === commentId)
          ? { ...c, replies: c.replies.filter((r) => r.id !== commentId) }
          : c)));
    } catch (err) {
      setError(err.message);
    }
  };

  // A comment id could belong to a top-level comment or to one of its
  // replies — this finds whichever it is and applies `updater` in place.
  const updateCommentById = (commentId, updater) => {
    setComments((cs) => cs.map((c) => {
      if (c.id === commentId) return updater(c);
      if (c.replies?.some((r) => r.id === commentId)) {
        return { ...c, replies: c.replies.map((r) => (r.id === commentId ? updater(r) : r)) };
      }
      return c;
    }));
  };

  const toggleReaction = async (commentId, emoji) => {
    try {
      const result = await authFetch(`/api/runs/${runId}/comments/${commentId}/reactions`, token, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      updateCommentById(commentId, (c) => ({ ...c, reactions: result.reactions, myReaction: result.myReaction }));
    } catch (err) {
      setError(err.message);
    } finally {
      setOpenPickerId(null);
    }
  };

  // parentId is always a specific comment's id — even for a reply, the
  // server resolves it back to the top-level ancestor, so it's safe to
  // always append into that top-level comment's replies here too.
  const submitReply = async (parentId) => {
    if (!replyBody.trim() || replySubmitting) return;
    setReplySubmitting(true);
    setError(null);
    try {
      const data = await authFetch(`/api/runs/${runId}/comments`, token, {
        method: "POST",
        body: JSON.stringify({ body: replyBody, parent_comment_id: parentId }),
      });
      const reply = { ...data.comment, reactions: data.comment.reactions || [], myReaction: data.comment.myReaction ?? null };
      setComments((cs) => cs.map((c) => (
        c.id === reply.parent_comment_id ? { ...c, replies: [...(c.replies || []), reply] } : c
      )));
      setReplyBody("");
      setOpenReplyId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setReplySubmitting(false);
    }
  };

  const busy = submitting || uploading;
  const commentCount = comments.reduce(
    (n, c) => n + (c.is_system ? 0 : 1) + (c.replies?.filter((r) => !r.is_system).length || 0),
    0
  );

  return (
    <div className="comments-section">
      <h2 className="section-title" style={{ fontSize: "1.05rem" }}>
        {occurrenceDate ? `Comments for ${formatOccurrenceDate(occurrenceDate)}` : "Comments"}
        {commentCount > 0 ? ` (${commentCount})` : ""}
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
          {comments.map((c, i) => {
            // Viewing everything (no date filter): comments are chronological,
            // so a run of the same occurrence_date is always contiguous —
            // just watch for it changing to know where to drop a divider.
            const showDivider = !occurrenceDate && c.occurrence_date !== comments[i - 1]?.occurrence_date;

            if (c.is_system) {
              return (
                <li key={c.id} className="comment-list-entry">
                  {showDivider && (
                    <div className="comment-date-divider">{formatOccurrenceDate(c.occurrence_date)}</div>
                  )}
                  <div className="comment-system-line">{c.body}</div>
                </li>
              );
            }

            return (
              <li key={c.id} className="comment-list-entry">
                {showDivider && (
                  <div className="comment-date-divider">{formatOccurrenceDate(c.occurrence_date)}</div>
                )}
                <CommentRow
                  comment={c}
                  token={token}
                  user={user}
                  onDelete={handleDelete}
                  onOpenLightbox={setLightbox}
                  activeAudioRef={activeAudioRef}
                  openPickerId={openPickerId}
                  setOpenPickerId={setOpenPickerId}
                  onToggleReaction={toggleReaction}
                  openReplyId={openReplyId}
                  setOpenReplyId={setOpenReplyId}
                  replyBody={replyBody}
                  setReplyBody={setReplyBody}
                  onSubmitReply={submitReply}
                  replySubmitting={replySubmitting}
                />

                {c.replies?.length > 0 && (
                  <div className="comment-replies">
                    {c.replies.map((r) => (
                      <CommentRow
                        key={r.id}
                        comment={r}
                        isReply
                        token={token}
                        user={user}
                        onDelete={handleDelete}
                        onOpenLightbox={setLightbox}
                        activeAudioRef={activeAudioRef}
                        openPickerId={openPickerId}
                        setOpenPickerId={setOpenPickerId}
                        onToggleReaction={toggleReaction}
                        openReplyId={openReplyId}
                        setOpenReplyId={setOpenReplyId}
                        replyBody={replyBody}
                        setReplyBody={setReplyBody}
                        onSubmitReply={submitReply}
                        replySubmitting={replySubmitting}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && hasMore && (
        <div ref={sentinelRef} className="comment-load-more-sentinel">
          {loadingMore && <p className="status-text loading">Loading more comments…</p>}
        </div>
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
