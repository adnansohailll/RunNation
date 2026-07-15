import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth, authFetch } from "./auth/useAuth.js";
import { IconTrash } from "./icons.jsx";

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function RunComments({ runId }) {
  const { user, token } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(() => {
    setLoading(true);
    fetch(`/api/runs/${runId}/comments`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load comments"))))
      .then((data) => setComments(data.comments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const data = await authFetch(`/api/runs/${runId}/comments`, token, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setComments((cs) => [...cs, data.comment]);
      setBody("");
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

  return (
    <div className="comments-section">
      <h2 className="section-title" style={{ fontSize: "1.05rem" }}>
        Comments{comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>

      {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}

      {token ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <textarea
            className="comment-textarea"
            placeholder="Share a tip, ask a question, or leave a note for this run…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            required
          />
          <button type="submit" className="comment-submit-btn" disabled={submitting || !body.trim()}>
            {submitting ? "Posting…" : "Post comment"}
          </button>
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
              <p className="comment-body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
