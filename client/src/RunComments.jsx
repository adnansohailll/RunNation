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

// Recursively transforms whichever node matches `id`, anywhere in the tree.
function mapCommentTree(comments, id, fn) {
  return comments.map((c) => {
    if (c.id === id) return fn(c);
    if (c.replies?.length) return { ...c, replies: mapCommentTree(c.replies, id, fn) };
    return c;
  });
}

// Recursively removes the node with the given id (and, implicitly, its
// whole reply subtree, since that subtree lives inside it).
function removeCommentFromTree(comments, id) {
  return comments
    .filter((c) => c.id !== id)
    .map((c) => (c.replies?.length ? { ...c, replies: removeCommentFromTree(c.replies, id) } : c));
}

// Recursively appends `reply` under whichever node has id === parentId.
function addReplyToTree(comments, parentId, reply) {
  return comments.map((c) => {
    if (c.id === parentId) return { ...c, replies: [...(c.replies || []), reply] };
    if (c.replies?.length) return { ...c, replies: addReplyToTree(c.replies, parentId, reply) };
    return c;
  });
}

// Counts every non-system comment in the tree, at any depth.
function countComments(comments) {
  return comments.reduce((n, c) => n + (c.is_system ? 0 : 1) + countComments(c.replies || []), 0);
}

/* ---- A single comment or reply — header, body, media, and the Facebook-
   style reaction/reply action row underneath — plus its own nested replies,
   rendered recursively so a reply chain can go to any depth. `depth` is 0
   for a top-level comment, 1 for a reply to it, 2 for a reply to that, etc. ---- */
function CommentRow({
  comment, depth, token, user, onDelete, onOpenLightbox, activeAudioRef,
  openPickerId, setOpenPickerId, onToggleReaction,
  openReplyId, setOpenReplyId, replyBody, setReplyBody, onSubmitReply, replySubmitting,
}) {
  const reactions = comment.reactions || [];
  const pickerOpen = openPickerId === comment.id;
  const replyOpen = openReplyId === comment.id;

  // One icon total: your own reaction takes priority; otherwise show
  // whichever emoji is most popular among everyone else's, so there's
  // still something to look at without a separate summary row.
  const totalReactionCount = reactions.reduce((n, r) => n + r.count, 0);
  const topReaction = reactions.length
    ? reactions.reduce((a, b) => (b.count > a.count ? b : a))
    : null;
  const displayEmoji = comment.myReaction || topReaction?.emoji || null;

  return (
    <div className={`comment-item${depth > 0 ? " comment-item-reply" : ""}`}>
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
        {token ? (
          <div className="comment-action-links">
            <div
              className="comment-like-wrapper"
              onMouseEnter={() => setOpenPickerId(comment.id)}
              // Selecting a reaction force-closes the picker (see toggleReaction)
              // without the mouse actually leaving this wrapper, so no fresh
              // mouseenter fires afterward — mousemove re-opens it as soon as
              // the still-hovering pointer so much as twitches.
              onMouseMove={() => setOpenPickerId(comment.id)}
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
                      aria-label={`React with ${REACTION_LABELS[emoji]}`}
                      title={REACTION_LABELS[emoji]}
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
                title={comment.myReaction ? `Remove ${REACTION_LABELS[comment.myReaction]}` : "Like"}
              >
                {displayEmoji ? (
                  <span className="comment-like-emoji" aria-hidden="true">{displayEmoji}</span>
                ) : (
                  <IconThumbsUp />
                )}
                {totalReactionCount > 0 ? totalReactionCount : "Like"}
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
        ) : (
          totalReactionCount > 0 && (
            <span className="comment-like-summary">
              <span className="comment-like-emoji" aria-hidden="true">{displayEmoji}</span>
              {totalReactionCount}
            </span>
          )
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

      {comment.replies?.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((r) => (
            <CommentRow
              key={r.id}
              comment={r}
              depth={depth + 1}
              token={token}
              user={user}
              onDelete={onDelete}
              onOpenLightbox={onOpenLightbox}
              activeAudioRef={activeAudioRef}
              openPickerId={openPickerId}
              setOpenPickerId={setOpenPickerId}
              onToggleReaction={onToggleReaction}
              openReplyId={openReplyId}
              setOpenReplyId={setOpenReplyId}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              onSubmitReply={onSubmitReply}
              replySubmitting={replySubmitting}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RunComments({ runId, occurrenceDate, onPosted, refreshKey }) {
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

  // refreshKey isn't read inside loadComments — it's purely a trigger bumped
  // by the calendar's per-date comment prompt after it posts.
  useEffect(() => {
    loadComments();
  }, [loadComments, refreshKey]);

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
      // Deleting a mid-thread reply takes its whole reply subtree with it
      // (the server cascades this via the FK), so removal has to recurse too.
      setComments((cs) => removeCommentFromTree(cs, commentId));
    } catch (err) {
      setError(err.message);
    }
  };

  // A comment id could belong to a top-level comment or to a reply at any
  // depth — this finds whichever it is and applies `updater` in place.
  const updateCommentById = (commentId, updater) => {
    setComments((cs) => mapCommentTree(cs, commentId, updater));
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

  // parentId is whichever comment's Reply button was actually clicked — a
  // top-level comment or a reply at any depth — and the new reply nests
  // directly under it.
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
      setComments((cs) => addReplyToTree(cs, parentId, reply));
      setReplyBody("");
      setOpenReplyId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setReplySubmitting(false);
    }
  };

  const busy = submitting || uploading;
  const commentCount = countComments(comments);

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
                  depth={0}
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
