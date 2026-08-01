import { useState } from "react";
import { IconArrowLeft, IconArrowRight } from "./icons.jsx";
import {
  addMonths, buildMonthGrid, dateOnly, isValidOccurrence, nextOccurrences, startOfMonth, toISODate,
} from "./runOccurrences.js";

const MONTH_LABEL = { month: "long", year: "numeric" };
const MAX_FUTURE_DATES = 2;

export default function RunCalendar({ weekday, earliest, selectedDate, onSelectDate }) {
  const today = dateOnly(new Date());
  const minDate = dateOnly(new Date(earliest));
  const maxDate = addMonths(today, 1);
  maxDate.setDate(today.getDate());

  const initialMonth = startOfMonth(selectedDate ? new Date(`${selectedDate}T00:00:00`) : today);
  const [viewMonth, setViewMonth] = useState(initialMonth);

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

          return (
            <button
              key={iso}
              type="button"
              className={`run-calendar-day is-valid${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
              onClick={() => onSelectDate(iso)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <p className="run-calendar-hint">
        Highlighted dates are when this run occurs. Select one to view or join that day's discussion.
      </p>
    </div>
  );
}
