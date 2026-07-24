/* ---- Date math for a run's recurring weekly occurrences.
   Runs only store a weekday (e.g. "Tuesday"), not calendar dates — these
   helpers turn that into an actual month grid + validity checks. ---- */

export const WEEKDAY_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

/* Local YYYY-MM-DD (unlike toISOString(), this doesn't shift by timezone) */
export const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const dateOnly = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

export const addMonths = (date, n) => new Date(date.getFullYear(), date.getMonth() + n, 1);

export const isValidOccurrence = (weekday, date, minDate, maxDate) =>
  date.getDay() === WEEKDAY_INDEX[weekday] && date >= minDate && date <= maxDate;

/* Weeks of {date, inMonth} cells (Sunday-first) covering the given month,
   padded with the trailing/leading days of neighboring months. */
export const buildMonthGrid = (year, month) => {
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());

  const weeks = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push({ date: cursor, inMonth: cursor.getMonth() === month });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
};
