import { to12hParts, to24hString } from "../utils.jsx";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

// Hour/minute/AM-PM dropdown trio for picking a run start time. Renders and
// edits a 24-hour "HH:MM" string (what the DB and backend validation expect)
// without exposing that format to the admin filling out the form.
export default function TimeSelect({ id, value, onChange, required }) {
  const { hour, minute, period } = to12hParts(value);

  const set = (next) => onChange(to24hString(next.hour ?? hour, next.minute ?? minute, next.period ?? period));

  return (
    <div className="time-select" role="group" aria-labelledby={id ? `${id}-label` : undefined}>
      <select
        id={id}
        className="auth-input time-select-part"
        value={hour}
        onChange={(e) => set({ hour: Number(e.target.value) })}
        required={required}
        aria-label="Hour"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="time-select-colon">:</span>
      <select
        className="auth-input time-select-part"
        value={minute}
        onChange={(e) => set({ minute: e.target.value })}
        required={required}
        aria-label="Minute"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        className="auth-input time-select-part time-select-period"
        value={period}
        onChange={(e) => set({ period: e.target.value })}
        required={required}
        aria-label="AM or PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
