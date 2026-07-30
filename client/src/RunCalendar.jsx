import { useState } from "react";
import { IconArrowLeft, IconArrowRight } from "./icons.jsx";
import {
  addMonths, buildMonthGrid, dateOnly, isValidOccurrence, startOfMonth, toISODate,
} from "./runOccurrences.js";

const MONTH_LABEL = { month: "long" };
const MAX_FUTURE_DATES = 2;

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
  const monthDates = weeks
    .flat()
    .filter(({ date, inMonth }) => inMonth && isValidOccurrence(weekday, date, minDate, maxDate))
    .map(({ date }) => date);

  /* Past dates (browsing history) are shown in full; only the upcoming
     ones in view are capped, so a busy month doesn't dump 4-5 pills at once. */
  const pastDates = monthDates.filter((date) => date < today);
  const futureDates = monthDates.filter((date) => date >= today).slice(0, MAX_FUTURE_DATES);
  const runDates = [...pastDates, ...futureDates];

  return (
    <div className="run-calendar">
      <h2 className="section-title" style={{ fontSize: "1.05rem" }}>Run Dates</h2>
      <p className="run-calendar-hint">Filter discussions by date</p>

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

      <div className="run-calendar-dates">
        {runDates.length === 0 ? (
          <p className="run-calendar-empty">No run dates this month.</p>
        ) : (
          runDates.map((date) => {
            const iso = toISODate(date);
            const isToday = date.getTime() === today.getTime();
            const isSelected = selectedDate === iso;

            return (
              <button
                key={iso}
                type="button"
                className={`run-calendar-date${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                onClick={() => onSelectDate(iso)}
              >
                {date.getDate()}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
