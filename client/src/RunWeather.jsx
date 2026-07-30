import { useEffect, useState } from "react";
import { errorMessage } from "./utils.jsx";

/* ---- WMO weather codes (as returned by Open-Meteo) mapped to a label + icon ---- */
const WEATHER_CODES = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mostly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Dense drizzle", icon: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "❄️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌦️" },
  82: { label: "Violent showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Snow showers", icon: "🌨️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm w/ hail", icon: "⛈️" },
  99: { label: "Thunderstorm w/ hail", icon: "⛈️" },
};

const weatherInfo = (code) => WEATHER_CODES[code] || { label: "—", icon: "🌡️" };

/* ---- "2026-08-02T07:00" -> "7:00 AM" ---- */
const formatHour12h = (isoTime) => {
  const hour24 = Number(isoTime.slice(11, 13));
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:00 ${period}`;
};

/* ---- Hourly forecast for a run's next occurrence (or a specific ?date=),
   windowed to 1hr before through 3hrs after the run's start time. ---- */
export default function RunWeather({ runId, date }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    setState({ loading: true, error: null, data: null });
    const qs = date ? `?date=${date}` : "";
    fetch(`/api/runs/${runId}/weather${qs}`)
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e.error));
        return res.json();
      })
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err) =>
        setState({ loading: false, error: errorMessage(err, "Failed to load weather."), data: null })
      );
  }, [runId, date]);

  const { loading, error, data } = state;

  return (
    <div className="run-weather">
      <h2 className="section-title" style={{ fontSize: "1.05rem" }}>Weather Forecast</h2>

      {loading && <p className="status-text loading">Loading weather…</p>}

      {!loading && error && (
        <p className="run-weather-empty">Couldn't load the weather forecast.</p>
      )}

      {!loading && !error && data && !data.available && (
        <p className="run-weather-empty">{data.reason || "Weather isn't available for this run."}</p>
      )}

      {!loading && !error && data?.available && (
        <>
          <p className="run-weather-date">
            {new Date(`${data.date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "long", month: "short", day: "numeric", year: "numeric",
            })}
            {data.recorded && <span className="run-weather-recorded-tag">Recorded</span>}
          </p>

          {data.hourly.length === 0 ? (
            <p className="run-weather-empty">No forecast data for this date yet — check back closer to the run.</p>
          ) : (
            <div className="run-weather-hours">
              {data.hourly.map((h) => {
                const info = weatherInfo(h.weatherCode);
                return (
                  <div key={h.time} className="run-weather-hour">
                    <span className="run-weather-hour-time">{formatHour12h(h.time)}</span>
                    <span className="run-weather-hour-icon" aria-hidden="true">{info.icon}</span>
                    <span className="run-weather-hour-temp">{Math.round(h.temperature)}°F</span>
                    {h.precipitationProbability != null && (
                      <span className="run-weather-hour-precip">💧 {h.precipitationProbability}%</span>
                    )}
                    <span className="run-weather-hour-label">{info.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
