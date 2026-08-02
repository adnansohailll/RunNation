import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconArrowLeft, IconArrowRight } from "./icons.jsx";
import { useAuth, authFetch } from "./auth/useAuth.js";
import {
  addMonths, buildMonthGrid, dateOnly, isValidOccurrence, nextOccurrences, startOfMonth, toISODate,
} from "./runOccurrences.js";

const MONTH_LABEL = { month: "long", year: "numeric" };
const MAX_FUTURE_DATES = 2;

const ATTEND_OPTIONS = [
  { value: "in", label: "I'm In" },
  { value: "cant", label: "Can't Make It" },
  { value: "interested", label: "Interested" },
];

// Prefilled starting point for the comment prompt that follows a status
// pick — the poster can still edit or clear it before posting.
const DEFAULT_COMMENT_BY_STATUS = {
  in: "I am coming",
  cant: "I am not coming",
  interested: "I'm interested, might join",
};

export default function RunCalendar({ runId, weekday, earliest, selectedDate, onSelectDate, onStatusChange, onCommentPosted }) {
  const { token } = useAuth();
  const today = dateOnly(new Date());
  const minDate = dateOnly(new Date(earliest));
  const maxDate = addMonths(today, 1);
  maxDate.setDate(today.getDate());

  const initialMonth = startOfMonth(selectedDate ? new Date(`${selectedDate}T00:00:00`) : today);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [statusByDate, setStatusByDate] = useState({});
  const [openDate, setOpenDate] = useState(null);
  const [savingDate, setSavingDate] = useState(null);

  // Which date is showing the post-selection "leave a comment" prompt instead
  // of the attend-menu, if any — independent of hover state (openDate) so it
  // stays put while the poster types, and only Post/Cancel close it.
  const [composeFor, setComposeFor] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const minMonth = startOfMonth(minDate);
  const atMinMonth = viewMonth <= minMonth;

  /* Past occurrences (browsing history) are shown in full; only the next
     couple of upcoming ones are enabled, so the calendar doesn't light up
     every future weekday match all the way out to maxDate. */
  const upcomingISOs = new Set(
    nextOccurrences(weekday, today, maxDate, MAX_FUTURE_DATES).map(toISODate)
  );
  const isEnabled = (date) => {
    if (!isValidOccurrence(weekday, date, minDate, maxDate)) return false;
    return date < today || upcomingISOs.has(toISODate(date));
  };

  const weeks = buildMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth());
  const monthDates = weeks.flat().filter(({ inMonth }) => inMonth).map(({ date }) => date);

  /* The "next month" arrow should only be usable when that month actually has
     an enabled date left inside the [minDate, maxDate] window — maxDate is a
     rolling ~1-month lookahead, not a month boundary, so most of the month
     after next is otherwise all-disabled dates. */
  const nextMonth = addMonths(viewMonth, 1);
  const nextMonthWeeks = buildMonthGrid(nextMonth.getFullYear(), nextMonth.getMonth());
  const nextMonthHasValidDate = nextMonthWeeks
    .flat()
    .some(({ date, inMonth }) => inMonth && isEnabled(date));
  const atMaxMonth = !nextMonthHasValidDate;

  /* Reload the caller's per-date attendance status whenever the run or the
     viewed month changes — scoped by month so this stays cheap no matter how
     long a run has been recurring for. */
  useEffect(() => {
    if (!token) return;
    const month = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}`;
    let cancelled = false;
    fetch(`/api/runs/${runId}/attendance-status?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => { if (!cancelled) setStatusByDate(data); })
      .catch(() => { if (!cancelled) setStatusByDate({}); });
    return () => { cancelled = true; };
  }, [runId, token, viewMonth]);

  // No token means nothing personal to show, regardless of what's cached
  // from a previous logged-in session in this component's lifetime.
  const effectiveStatusByDate = token ? statusByDate : {};

  const setDot = (iso, status) => {
    setStatusByDate((s) => {
      const next = { ...s };
      if (status) next[iso] = status;
      else delete next[iso];
      return next;
    });
  };

  const pickStatus = async (iso, status) => {
    if (savingDate) return;
    const previous = statusByDate[iso];

    // Flip the dot immediately rather than waiting on the round trip — the
    // first request after a page load pays for connection warm-up (fresh
    // browser connection, fresh DB pool connection) and feels sluggish
    // otherwise, even though later picks are fast.
    setOpenDate(null);
    setSavingDate(iso);
    setDot(iso, previous === status ? null : status);

    try {
      const result = await authFetch(`/api/runs/${runId}/attendance`, token, {
        method: "POST",
        body: JSON.stringify({ date: iso, status }),
      });
      setDot(iso, result.status);
      onStatusChange?.(iso);
      // Only prompt for a comment when a status was actually set (not when
      // the pick cleared it back off) — the status itself is already saved
      // at this point regardless of what happens with the prompt below.
      if (result.status) {
        setComposeFor({ date: iso, status: result.status });
        setCommentText(DEFAULT_COMMENT_BY_STATUS[result.status] || "");
      }
    } catch {
      setDot(iso, previous); // roll back — the pick didn't actually stick
    } finally {
      setSavingDate(null);
    }
  };

  const submitStatusComment = async () => {
    if (!composeFor || commentSubmitting || !commentText.trim()) return;
    setCommentSubmitting(true);
    try {
      await authFetch(`/api/runs/${runId}/comments`, token, {
        method: "POST",
        body: JSON.stringify({ body: commentText, occurrence_date: composeFor.date }),
      });
      onCommentPosted?.(composeFor.date);
      setComposeFor(null);
      setCommentText("");
    } catch {
      // Leave the popup open with the text intact so the poster can retry.
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Discards the draft comment only — the attendance status picked just
  // before this was already saved and stays exactly as chosen.
  const cancelStatusComment = () => {
    setComposeFor(null);
    setCommentText("");
  };

  return (
    <div className="run-calendar">
      <div className="run-calendar-header">
        <button
          type="button"
          className="run-calendar-nav-btn"
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          disabled={atMinMonth}
          aria-label="Previous month"
        >
          <IconArrowLeft />
        </button>
        <span className="run-calendar-month-label">
          {viewMonth.toLocaleDateString(undefined, MONTH_LABEL)}
        </span>
        <button
          type="button"
          className="run-calendar-nav-btn"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          disabled={atMaxMonth}
          aria-label="Next month"
        >
          <IconArrowRight />
        </button>
      </div>

      <div className="run-calendar-grid">
        {monthDates.map((date) => {
          const iso = toISODate(date);
          const valid = isEnabled(date);
          const isToday = date.getTime() === today.getTime();
          const isSelected = selectedDate === iso;

          if (!valid) {
            return (
              <span key={iso} className="run-calendar-day is-disabled">
                {date.getDate()}
              </span>
            );
          }

          const canPick = date >= today;
          const status = effectiveStatusByDate[iso];
          const isOpen = openDate === iso;
          const isComposing = composeFor?.date === iso;

          return (
            <div
              key={iso}
              className="run-calendar-day-cell"
              onMouseEnter={() => canPick && setOpenDate(iso)}
              onMouseLeave={() => setOpenDate((d) => (d === iso ? null : d))}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setOpenDate((d) => (d === iso ? null : d));
              }}
            >
              <button
                type="button"
                className={`run-calendar-day is-valid${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                onClick={() => onSelectDate(iso)}
                onFocus={() => canPick && setOpenDate(iso)}
              >
                {date.getDate()}
              </button>

              <span className="run-calendar-status-slot">
                {status && <span className={`run-calendar-status-dot is-${status}`} aria-hidden="true" />}
              </span>

              {isComposing && (
                <div className="run-calendar-attend-menu">
                  <div className="run-calendar-comment-popup">
                    <textarea
                      className="run-calendar-comment-textarea"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={2}
                      autoFocus
                    />
                    <div className="run-calendar-comment-actions">
                      <button
                        type="button"
                        className="run-calendar-comment-cancel"
                        onClick={cancelStatusComment}
                        disabled={commentSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="run-calendar-comment-post"
                        onClick={submitStatusComment}
                        disabled={commentSubmitting || !commentText.trim()}
                      >
                        {commentSubmitting ? "Posting…" : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!isComposing && canPick && isOpen && (
                <div className="run-calendar-attend-menu">
                  <div className="run-calendar-attend-menu-inner">
                    {token ? (
                      ATTEND_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`run-calendar-attend-option${status === opt.value ? " is-active" : ""}`}
                          disabled={savingDate === iso}
                          onClick={() => pickStatus(iso, opt.value)}
                        >
                          <span className={`run-calendar-status-dot is-${opt.value}`} aria-hidden="true" />
                          {opt.label}
                        </button>
                      ))
                    ) : (
                      <Link to="/login" className="run-calendar-attend-login-link">
                        Log in to set status
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="run-calendar-hint">
        Highlighted dates are when this run occurs. Select one to view or join that day's discussion,
        or hover to set whether you're attending.
      </p>
    </div>
  );
}
