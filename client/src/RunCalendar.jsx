import { useState } from "react";
import { IconArrowLeft, IconArrowRight } from "./icons.jsx";
import { WEEKDAYS } from "./utils.jsx";
import {
  addMonths, buildMonthGrid, dateOnly, isValidOccurrence, startOfMonth, toISODate,
} from "./runOccurrences.js";

const MONTH_LABEL = { month: "long", year: "numeric" };

export default function RunCalendar({ weekday, earliest, selectedDate, onSelectDate }) {
  const today = dateOnly(new Date());
  const minDate = dateOnly(new Date(earliest));
  const maxDate = addMonths(today, 1);
  maxDate.setDate(today.getDate());

  const initialMonth = startOfMonth(selectedDate ? new Date(`${selectedDate}T00:00:00`) : today);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const minMonth = startOfMonth(minDate);
  const maxMonth = startOfMonth(maxDate);
  const atMinMonth = viewMonth <= minMonth;
  const atMaxMonth = viewMonth >= maxMonth;

  const weeks = buildMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth());

  return (
    <div className="run-calendar">
      <h2 className="section-title" style={{ fontSize: "1.05rem" }}>Run Dates</h2>

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
        {WEEKDAYS.map((w) => (
          <span key={w.full} className="run-calendar-weekday">{w.short}</span>
        ))}

        {weeks.flat().map(({ date, inMonth }) => {
          const iso = toISODate(date);
          const valid = inMonth && isValidOccurrence(weekday, date, minDate, maxDate);
          const isToday = date.getTime() === today.getTime();
          const isSelected = selectedDate === iso;

          if (!valid) {
            return (
              <span
                key={iso}
                className={`run-calendar-day is-disabled${inMonth ? "" : " is-outside"}`}
              >
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
