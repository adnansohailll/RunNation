/* ---- Colored weather icons (explicit fills, not currentColor — unlike the
   app's monochrome icon set in icons.jsx, these need to read as color-coded
   conditions regardless of the emoji font available in the viewer's
   browser/OS). ---- */

const SUN = "#FFB300";
const CLOUD = "#90A4AE";
const CLOUD_DARK = "#607D8B";
const RAIN = "#4FC3F7";
const SNOW = "#81D4FA";
const BOLT = "#FFCA28";

const Sun = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <circle cx="18" cy="18" r="8" fill={SUN} />
    <g stroke={SUN} strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="2" x2="18" y2="6" />
      <line x1="18" y1="30" x2="18" y2="34" />
      <line x1="2" y1="18" x2="6" y2="18" />
      <line x1="30" y1="18" x2="34" y2="18" />
      <line x1="6.5" y1="6.5" x2="9.2" y2="9.2" />
      <line x1="26.8" y1="26.8" x2="29.5" y2="29.5" />
      <line x1="6.5" y1="29.5" x2="9.2" y2="26.8" />
      <line x1="26.8" y1="9.2" x2="29.5" y2="6.5" />
    </g>
  </svg>
);

const Cloud = ({ fill = CLOUD }) => (
  <path d="M10.5 27a6 6 0 0 1-.5-12 8 8 0 0 1 15.4-2.6A6.5 6.5 0 0 1 25 27Z" fill={fill} />
);

const PartlyCloudy = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <circle cx="14" cy="13" r="6.5" fill={SUN} />
    <Cloud />
  </svg>
);

const Cloudy = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <Cloud fill={CLOUD_DARK} />
  </svg>
);

const Fog = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <Cloud />
    <g stroke={CLOUD_DARK} strokeWidth="2" strokeLinecap="round">
      <line x1="7" y1="30" x2="29" y2="30" />
      <line x1="9" y1="33.5" x2="27" y2="33.5" />
    </g>
  </svg>
);

const Drops = ({ y, opacity = 1 }) => (
  <g stroke={RAIN} strokeWidth="2.4" strokeLinecap="round" opacity={opacity}>
    <line x1="12" y1={y} x2="10.5" y2={y + 4} />
    <line x1="18" y1={y} x2="16.5" y2={y + 4} />
    <line x1="24" y1={y} x2="22.5" y2={y + 4} />
  </g>
);

const Drizzle = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <Cloud />
    <Drops y={28} opacity={0.85} />
  </svg>
);

const Rain = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <Cloud fill={CLOUD_DARK} />
    <Drops y={28} />
  </svg>
);

const HeavyRain = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <Cloud fill={CLOUD_DARK} />
    <Drops y={27} />
    <Drops y={31.5} opacity={0.7} />
  </svg>
);

const Snowflake = ({ x, y }) => (
  <g stroke={SNOW} strokeWidth="1.8" strokeLinecap="round" transform={`translate(${x} ${y})`}>
    <line x1="0" y1="-3" x2="0" y2="3" />
    <line x1="-2.6" y1="-1.5" x2="2.6" y2="1.5" />
    <line x1="-2.6" y1="1.5" x2="2.6" y2="-1.5" />
  </g>
);

const Snow = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <Cloud />
    <Snowflake x={12} y={30} />
    <Snowflake x={18} y={26} />
    <Snowflake x={24} y={30} />
  </svg>
);

const FreezingRain = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <Cloud fill={CLOUD_DARK} />
    <Drops y={27} />
    <Snowflake x={18} y={32.5} />
  </svg>
);

const Storm = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <Cloud fill={CLOUD_DARK} />
    <path d="M19 24l-5.5 8h4l-2.5 6 7-9h-4Z" fill={BOLT} />
  </svg>
);

const HailStorm = () => (
  <svg viewBox="0 0 36 36" width="28" height="28">
    <Cloud fill={CLOUD_DARK} />
    <path d="M22 24l-5 7h3.5l-2 5.5 6-8h-3.5Z" fill={BOLT} />
    <circle cx="10.5" cy="30" r="1.7" fill={SNOW} />
  </svg>
);

const WEATHER_ICONS = {
  sun: Sun,
  "partly-cloudy": PartlyCloudy,
  cloudy: Cloudy,
  fog: Fog,
  drizzle: Drizzle,
  rain: Rain,
  "heavy-rain": HeavyRain,
  "freezing-rain": FreezingRain,
  snow: Snow,
  storm: Storm,
  hail: HailStorm,
};

export default function WeatherIcon({ name }) {
  const Icon = WEATHER_ICONS[name] || Cloudy;
  return <Icon />;
}
