import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconArrowLeft, IconArrowRight, IconUsers } from "./icons.jsx";
import { useAuth, authFetch } from "./auth/useAuth.js";
import {
  WEEKDAY_INDEX, addMonths, buildMonthGrid, dateOnly, isValidOccurrence, nextOccurrences, toISODate,
} from "./runOccurrences.js";

const MONTHS_VISIBLE = 3;
const COLUMN_MONTH_LABEL = { month: "short" };
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

const monthParam = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

// "Aug-26" style short label for the header range line.
const formatMonthYY = (date) =>
  `${date.toLocaleDateString(undefined, { month: "short" })}-${String(date.getFullYear()).slice(-2)}`;

// First month of the calendar quarter (Jan/Apr/Jul/Oct) a date falls in.
const quarterStart = (date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / MONTHS_VISIBLE) * MONTHS_VISIBLE, 1);

export default function RunCalendar({ runId, weekday, earliest, selectedDate, onSelectDate, onCommentPosted }) {
  const { token, user } = useAuth();
  const today = dateOnly(new Date());
  const minDate = dateOnly(new Date(earliest));
  const maxDate = addMonths(today, 1);
  maxDate.setDate(today.getDate());

  // viewMonth is the first month of the visible calendar quarter (Jan-Mar,
  // Apr-Jun, ...) — the slider arrows jump a whole quarter at a time.
  const initialMonth = quarterStart(selectedDate ? new Date(`${selectedDate}T00:00:00`) : today);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [statusByDate, setStatusByDate] = useState({});
  const [openDate, setOpenDate] = useState(null);
  const [savingDate, setSavingDate] = useState(null);
  const [summaryByDate, setSummaryByDate] = useState({});
  const [hoveredSummaryDate, setHoveredSummaryDate] = useState(null);

  // Which date is showing the post-selection "leave a comment" prompt instead
  // of the attend-menu, if any — independent of hover state (openDate) so it
  // stays put while the poster types, and only Post/Cancel close it.
  const [composeFor, setComposeFor] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Backward is bounded — dates before the run existed are meaningless to
  // show. Forward is bounded too, just further down (atMaxMonth) once
  // isEnabled/getMonthDates exist: no point browsing into a quarter with
  // nothing active in it.
  const minMonth = quarterStart(minDate);
  const atMinMonth = viewMonth <= minMonth;

  const visibleMonths = Array.from({ length: MONTHS_VISIBLE }, (_, i) => addMonths(viewMonth, i));

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

  // Every date this weekday falls on in the given month — not just the ones
  // currently open for RSVP (isEnabled, above) — so each row shows the run's
  // whole recurring pattern; isEnabled just decides which cells are active.
  const getMonthDates = (monthDate) =>
    buildMonthGrid(monthDate.getFullYear(), monthDate.getMonth())
      .flat()
      .filter(({ inMonth }) => inMonth)
      .map(({ date }) => date)
      .filter((date) => date.getDay() === WEEKDAY_INDEX[weekday]);

  // Disable "next" once the quarter after this one has no active (open for
  // RSVP, or already-past) date in it at all — nothing but gray placeholder
  // dates to browse into past that point.
  const nextQuarterMonths = Array.from({ length: MONTHS_VISIBLE }, (_, i) =>
    addMonths(viewMonth, MONTHS_VISIBLE + i)
  );
  const atMaxMonth = !nextQuarterMonths.some((m) => getMonthDates(m).some(isEnabled));

  /* Reload the caller's per-date attendance status whenever the run or the
     visible 3-month window changes — one request per visible month, merged,
     so this stays cheap no matter how long a run has been recurring for. */
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all(
      visibleMonths.map((m) =>
        fetch(`/api/runs/${runId}/attendance-status?month=${monthParam(m)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }).then((res) => (res.ok ? res.json() : {}))
      )
    )
      .then((results) => { if (!cancelled) setStatusByDate(Object.assign({}, ...results)); })
      .catch(() => { if (!cancelled) setStatusByDate({}); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleMonths is derived fresh from viewMonth each render
  }, [runId, token, viewMonth]);

  // Who's "in" and who's "interested" in each date across the visible
  // months — public, not tied to the viewer's own login, so it reloads
  // independently of the status fetch above. no-store because the same URLs
  // get re-requested right after a pick below (see pickStatus) and a
  // 304-from-cache there would mask the fresh pick.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      visibleMonths.map((m) =>
        fetch(`/api/runs/${runId}/attendance-summary?month=${monthParam(m)}`, { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : {}))
      )
    )
      .then((results) => { if (!cancelled) setSummaryByDate(Object.assign({}, ...results)); })
      .catch(() => { if (!cancelled) setSummaryByDate({}); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleMonths is derived fresh from viewMonth each render
  }, [runId, viewMonth]);

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

  // Keep the badge's "in"/"interested" lists in sync with the viewer's own
  // pick immediately, rather than waiting on the next month-level refetch.
  // newStatus is whichever of 'in' | 'interested' | 'cant' | null just got
  // saved — the viewer moves into that list (if any) and out of the other.
  const setMineInSummary = (iso, newStatus) => {
    if (!user) return;
    setSummaryByDate((prev) => {
      const entry = prev[iso] || { in: [], interested: [] };
      const stripped = {
        in: entry.in.filter((p) => p.id !== user.id),
        interested: entry.interested.filter((p) => p.id !== user.id),
      };
      if (newStatus === "in" || newStatus === "interested") {
        stripped[newStatus] = [...stripped[newStatus], { id: user.id, name: user.name }]
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      if (stripped.in.length === 0 && stripped.interested.length === 0) {
        if (!(iso in prev)) return prev;
        const next = { ...prev };
        delete next[iso];
        return next;
      }
      return { ...prev, [iso]: stripped };
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
      // Optimistic first (instant feedback), then reconcile against the
      // server's own view of who's in/interested — catches cases where the
      // optimistic guess can't be trusted (e.g. `user` hasn't loaded yet).
      setMineInSummary(iso, result.status);
      Promise.all(
        visibleMonths.map((m) =>
          fetch(`/api/runs/${runId}/attendance-summary?month=${monthParam(m)}`, { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : {}))
        )
      )
        .then((results) => setSummaryByDate(Object.assign({}, ...results)))
        .catch(() => {});
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

  const renderDateCell = (date) => {
    const iso = toISODate(date);
    const active = isEnabled(date);

    // Not (yet) open for RSVP — e.g. before the run existed, or a future
    // occurrence beyond the near-term window below. Still shown so the
    // recurring pattern for the month is visible, just inert.
    if (!active) {
      return (
        <div key={iso} className="run-calendar-day-cell">
          <span className="run-calendar-day is-inactive">{date.getDate()}</span>
        </div>
      );
    }

    const isToday = date.getTime() === today.getTime();
    const isSelected = selectedDate === iso;
    const canPick = date >= today;
    const status = effectiveStatusByDate[iso];
    const isOpen = openDate === iso;
    const isComposing = composeFor?.date === iso;
    const summary = summaryByDate[iso] || { in: [], interested: [] };
    const totalAttendance = summary.in.length + summary.interested.length;

    return (
      <div key={iso} className="run-calendar-day-cell">
        <div
          className="run-calendar-day-trigger"
          onMouseEnter={() => canPick && setOpenDate(iso)}
          onMouseLeave={() => setOpenDate((d) => (d === iso ? null : d))}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setOpenDate((d) => (d === iso ? null : d));
          }}
        >
          <button
            type="button"
            className={`run-calendar-day is-valid${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}${status ? ` has-status-${status}` : ""}`}
            onClick={() => onSelectDate(iso)}
            onFocus={() => canPick && setOpenDate(iso)}
          >
            {date.getDate()}
          </button>

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

        <span
          className={`run-calendar-interested-badge${totalAttendance === 0 ? " is-empty" : ""}`}
          tabIndex={0}
          onMouseEnter={() => setHoveredSummaryDate(iso)}
          onMouseLeave={() => setHoveredSummaryDate((d) => (d === iso ? null : d))}
          onFocus={() => setHoveredSummaryDate(iso)}
          onBlur={() => setHoveredSummaryDate((d) => (d === iso ? null : d))}
          aria-label={`${summary.in.length} going, ${summary.interested.length} interested`}
        >
          <IconUsers />
          {hoveredSummaryDate === iso && (
            <div className="run-calendar-interested-popover">
              <div className="run-calendar-attendance-panel">
                <div className="run-calendar-attendance-group">
                  <p className="run-calendar-attendance-heading">{summary.in.length} going</p>
                  <ul className="run-calendar-interested-list">
                    {summary.in.length === 0
                      ? <li className="run-calendar-attendance-empty">No one yet</li>
                      : summary.in.map((p) => <li key={p.id}>{p.name}</li>)}
                  </ul>
                </div>
                <div className="run-calendar-attendance-group">
                  <p className="run-calendar-attendance-heading">{summary.interested.length} interested</p>
                  <ul className="run-calendar-interested-list">
                    {summary.interested.length === 0
                      ? <li className="run-calendar-attendance-empty">No one yet</li>
                      : summary.interested.map((p) => <li key={p.id}>{p.name}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </span>
      </div>
    );
  };

  return (
    <div className="run-calendar">
      <div className="run-calendar-header">
        <button
          type="button"
          className="run-calendar-nav-btn"
          onClick={() => setViewMonth((m) => addMonths(m, -MONTHS_VISIBLE))}
          disabled={atMinMonth}
          aria-label="Previous quarter"
        >
          <IconArrowLeft />
        </button>
        <span className="run-calendar-month-label">
          {formatMonthYY(visibleMonths[0])} - {formatMonthYY(visibleMonths[MONTHS_VISIBLE - 1])}
        </span>
        <button
          type="button"
          className="run-calendar-nav-btn"
          onClick={() => setViewMonth((m) => addMonths(m, MONTHS_VISIBLE))}
          disabled={atMaxMonth}
          aria-label="Next quarter"
        >
          <IconArrowRight />
        </button>
      </div>

      <div className="run-calendar-months">
        {visibleMonths.map((monthDate) => (
          <div className="run-calendar-month-col" key={monthParam(monthDate)}>
            <span className="run-calendar-month-col-label">
              {monthDate.toLocaleDateString(undefined, COLUMN_MONTH_LABEL)}
            </span>
            <div className="run-calendar-grid">
              {getMonthDates(monthDate).map(renderDateCell)}
            </div>
          </div>
        ))}
      </div>

      <p className="run-calendar-hint">
        Highlighted dates are when this run occurs. Select one to view or join that day's discussion,
        or hover to set whether you're attending.
      </p>
    </div>
  );
}
