// One-time (safe to re-run) script: seeds ~15-20 realistic Jersey Shore
// running clubs and ~100 recurring weekly runs spread across them, with
// each run's created_at backdated to a random point in the past year so
// the data doesn't look like it was all added today.
//
// Usage: node scripts/seed-sample-data.js   (run from server/, needs .env loaded)
import 'dotenv/config';
import pool from '../src/db.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WEEKDAY_MORNING_TIMES = ['06:00', '06:30', '07:00'];
const WEEKDAY_EVENING_TIMES = ['17:30', '18:00', '18:30', '19:00'];
const WEEKEND_MORNING_TIMES = ['07:00', '07:30', '08:00', '09:00'];

const DISTANCES = [
  '2 to 4 Miles', '3 Miles', '3 to 5 Miles', '4 to 6 Miles', '5 KM',
  '5K to 10K', '6 to 8 Miles', '8 to 10 Miles', '10K', 'Up to 10 Miles',
  '3 to 10+ Miles',
];

const TERRAINS = ['Road (Boardwalk)', 'Road', 'Trail', 'Track', 'Mixed (Road/Trail)'];

const PACE_GROUPS = [
  'All levels welcome',
  'Beginner to Intermediate',
  'Run/Walk friendly',
  'Sub-8:00/mile pace group available',
  'All paces — no one gets left behind',
];

const STREETS = [
  'Ocean Ave', 'Boardwalk', 'Main St', 'Broadway', 'Washington Ave',
  'Atlantic Ave', 'Beach Ave', 'Center St', '1st Ave', '10th Ave',
  'Brighton Ave', 'Sunset Ave',
];

const LOCATION_SUFFIXES = [
  'Boardwalk', 'Beach Entrance', 'Town Square', 'Pier', 'Municipal Park',
  'Welcome Center', 'Gazebo', 'Bandshell',
];

// Jersey Shore towns, north to south, with approximate town-center coords.
const CLUBS = [
  {
    name: 'Sea Bright Sunrise Runners',
    description: 'A friendly early-morning running group along the northern Monmouth County coastline. We welcome runners of every pace for our sunrise loops before the workday starts.',
    location: 'Sea Bright, NJ',
    contact_email: 'info@seabrightsunriserunners.org',
    website: 'www.seabrightsunriserunners.org',
    meetup_day: 'Tuesday',
    meetup_time: '06:00',
    lat: 40.3629, lng: -73.9757,
  },
  {
    name: 'Long Branch Boardwalk Striders',
    description: "Long Branch's longest-running boardwalk group, mixing social pace runs with a monthly speed workout at the track.",
    location: 'Long Branch, NJ',
    contact_email: 'hello@lbboardwalkstriders.com',
    website: 'www.lbboardwalkstriders.com',
    meetup_day: 'Thursday',
    meetup_time: '18:00',
    lat: 40.3043, lng: -73.9924,
  },
  {
    name: 'Asbury Park Running Collective',
    description: 'A community-driven club based out of Asbury Park, blending boardwalk cruises with trail trips to Hartshorne Woods.',
    location: 'Asbury Park, NJ',
    contact_email: 'run@asburyparkcollective.org',
    website: 'www.asburyparkcollective.org',
    meetup_day: 'Wednesday',
    meetup_time: '18:30',
    lat: 40.2204, lng: -74.0121,
  },
  {
    name: 'Ocean Grove Front Porch Runners',
    description: 'Small-town charm meets serious mileage — we run past the Great Auditorium every Sunday before the tent community wakes up.',
    location: 'Ocean Grove, NJ',
    contact_email: 'frontporchrunners@gmail.com',
    website: '',
    meetup_day: 'Sunday',
    meetup_time: '07:00',
    lat: 40.2075, lng: -74.0054,
  },
  {
    name: 'Bradley Beach Milers',
    description: 'Casual, no-drop group runs along the Bradley Beach boardwalk with a rotating route down to Avon and back.',
    location: 'Bradley Beach, NJ',
    contact_email: 'info@bradleybeachmilers.com',
    website: 'www.bradleybeachmilers.com',
    meetup_day: 'Saturday',
    meetup_time: '08:00',
    lat: 40.2032, lng: -74.0129,
  },
  {
    name: 'Belmar Beach Runners Club',
    description: "One of the Shore's largest running clubs, hosting weekly social runs and training groups for the Belmar 5-Mile and NYC Marathon.",
    location: 'Belmar, NJ',
    contact_email: 'info@belmarbeachrunners.org',
    website: 'www.belmarbeachrunners.org',
    meetup_day: 'Tuesday',
    meetup_time: '18:00',
    lat: 40.1801, lng: -74.0165,
  },
  {
    name: 'Spring Lake Lakefront Runners',
    description: 'Quiet, scenic loops around Spring Lake with an emphasis on beginner-friendly pacing and Saturday long runs.',
    location: 'Spring Lake, NJ',
    contact_email: 'hello@springlakerunners.org',
    website: '',
    meetup_day: 'Saturday',
    meetup_time: '07:30',
    lat: 40.1526, lng: -74.0293,
  },
  {
    name: 'Manasquan River Runners',
    description: 'A tight-knit group that trains along the Manasquan River and boardwalk, with a strong presence at local Shore races.',
    location: 'Manasquan, NJ',
    contact_email: 'run@manasquanriverrunners.com',
    website: 'www.manasquanriverrunners.com',
    meetup_day: 'Thursday',
    meetup_time: '18:00',
    lat: 40.1226, lng: -74.0546,
  },
  {
    name: 'Point Pleasant Pacesetters',
    description: "Point Pleasant Beach's community running club, known for its post-run coffee stops and welcoming attitude toward new runners.",
    location: 'Point Pleasant Beach, NJ',
    contact_email: 'info@ppbpacesetters.org',
    website: 'www.ppbpacesetters.org',
    meetup_day: 'Monday',
    meetup_time: '18:00',
    lat: 40.0834, lng: -74.0454,
  },
  {
    name: 'Seaside Heights Boardwalk Runners',
    description: 'Runs the length of the Seaside boardwalk year-round, rain or shine, with a beginner run/walk group every week.',
    location: 'Seaside Heights, NJ',
    contact_email: 'seasideboardwalkrunners@gmail.com',
    website: '',
    meetup_day: 'Wednesday',
    meetup_time: '18:00',
    lat: 39.9410, lng: -74.0743,
  },
  {
    name: 'Long Beach Island Sandpipers',
    description: 'Island-wide running club covering Ship Bottom to Beach Haven, with routes that shift with the tide schedule.',
    location: 'Ship Bottom, NJ',
    contact_email: 'info@lbisandpipers.org',
    website: 'www.lbisandpipers.org',
    meetup_day: 'Saturday',
    meetup_time: '07:00',
    lat: 39.6559, lng: -74.1815,
  },
  {
    name: 'Barnegat Light Lighthouse Loop Runners',
    description: 'Small club based at the north end of LBI, famous for its loop around Barnegat Lighthouse State Park.',
    location: 'Barnegat Light, NJ',
    contact_email: 'lighthouseloop@gmail.com',
    website: '',
    meetup_day: 'Sunday',
    meetup_time: '08:00',
    lat: 39.7590, lng: -74.1090,
  },
  {
    name: 'Brigantine Bay Runners',
    description: 'Runs along the beach and back bays of Brigantine, drawing runners training for the Atlantic City Marathon.',
    location: 'Brigantine, NJ',
    contact_email: 'info@brigantinebayrunners.com',
    website: 'www.brigantinebayrunners.com',
    meetup_day: 'Tuesday',
    meetup_time: '06:00',
    lat: 39.4101, lng: -74.3646,
  },
  {
    name: 'Atlantic City Boardwalk Ramblers',
    description: 'Group runs on the AC Boardwalk between the casinos, with a strong social scene and post-run breakfast tradition.',
    location: 'Atlantic City, NJ',
    contact_email: 'ramblers@acboardwalkrun.org',
    website: 'www.acboardwalkrun.org',
    meetup_day: 'Thursday',
    meetup_time: '06:30',
    lat: 39.3643, lng: -74.4229,
  },
  {
    name: 'Ocean City Family Fun Runners',
    description: 'A family-friendly club welcoming kids, strollers, and dogs on our relaxed boardwalk routes.',
    location: 'Ocean City, NJ',
    contact_email: 'familyfunrunners@gmail.com',
    website: '',
    meetup_day: 'Saturday',
    meetup_time: '09:00',
    lat: 39.2776, lng: -74.5746,
  },
  {
    name: 'Sea Isle City Sunrise Striders',
    description: 'Early risers who chase the sunrise along the Sea Isle promenade before the summer crowds arrive.',
    location: 'Sea Isle City, NJ',
    contact_email: 'info@seaislestriders.org',
    website: 'www.seaislestriders.org',
    meetup_day: 'Friday',
    meetup_time: '06:00',
    lat: 39.1487, lng: -74.6857,
  },
  {
    name: 'Avalon-Stone Harbor Running Club',
    description: 'Serving both Seven Mile Island towns, with a mix of beach runs and inland routes through the wetlands.',
    location: 'Avalon, NJ',
    contact_email: 'info@asharunningclub.org',
    website: 'www.asharunningclub.org',
    meetup_day: 'Wednesday',
    meetup_time: '17:30',
    lat: 39.1012, lng: -74.7176,
  },
  {
    name: 'Wildwood Crest Coasters',
    description: 'Boardwalk-based club running the full Wildwoods boardwalk loop with a strong winter training group.',
    location: 'Wildwood Crest, NJ',
    contact_email: 'coasters@wildwoodrun.org',
    website: '',
    meetup_day: 'Monday',
    meetup_time: '18:00',
    lat: 38.9906, lng: -74.8154,
  },
  {
    name: 'Cape May Point Pacers',
    description: 'The southernmost club on the Shore, known for scenic runs past the lighthouse and along Sunset Beach.',
    location: 'Cape May, NJ',
    contact_email: 'info@capemaypacers.org',
    website: 'www.capemaypacers.org',
    meetup_day: 'Sunday',
    meetup_time: '07:30',
    lat: 38.9351, lng: -74.9060,
  },
  {
    name: 'Red Bank River Runners',
    description: 'An inland Monmouth County club running along the Navesink River and Marine Park, popular with weekday commuters.',
    location: 'Red Bank, NJ',
    contact_email: 'info@redbankriverrunners.org',
    website: 'www.redbankriverrunners.org',
    meetup_day: 'Tuesday',
    meetup_time: '18:30',
    lat: 40.3471, lng: -74.0643,
  },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(value) {
  return value + (Math.random() - 0.5) * 0.03;
}

function randomStartTime(weekday) {
  const isWeekend = weekday === 'Sunday' || weekday === 'Saturday';
  if (isWeekend) return pick(WEEKEND_MORNING_TIMES);
  return pick([...WEEKDAY_MORNING_TIMES, ...WEEKDAY_EVENING_TIMES]);
}

function randomBackdatedTimestamp() {
  const now = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const offset = Math.floor(Math.random() * oneYearMs);
  return new Date(now - offset);
}

function buildRunsForClub(club) {
  const runCount = 3 + Math.floor(Math.random() * 4); // 3-6 runs per club
  const runs = [];
  for (let i = 0; i < runCount; i++) {
    const weekday = pick(WEEKDAYS);
    const townName = club.location.replace(', NJ', '');
    runs.push({
      weekday,
      start_times: randomStartTime(weekday),
      meetup_location: `${townName} ${pick(LOCATION_SUFFIXES)}`,
      address_intersection: `${pick(STREETS)} & ${pick(STREETS)} - ${club.location}`,
      average_distance: pick(DISTANCES),
      terrain: pick(TERRAINS),
      pace_groups: pick(PACE_GROUPS),
      latitude: jitter(club.lat),
      longitude: jitter(club.lng),
      created_at: randomBackdatedTimestamp(),
    });
  }
  return runs;
}

async function main() {
  await pool.query(`ALTER TABLE run_metadata ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`);

  const { rows: existing } = await pool.query('SELECT id FROM clubs WHERE name = $1', [CLUBS[0].name]);
  if (existing.length > 0) {
    console.log(`"${CLUBS[0].name}" already exists — sample data looks already seeded. Skipping.`);
    await pool.end();
    return;
  }

  const { rows: admins } = await pool.query(
    "SELECT id FROM users WHERE role = 'super_admin' ORDER BY id LIMIT 1"
  );
  const createdBy = admins[0]?.id ?? null;

  let clubCount = 0;
  let runCount = 0;

  for (const club of CLUBS) {
    const { rows } = await pool.query(
      `INSERT INTO clubs (name, description, location, contact_email, website, meetup_day, meetup_time, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [club.name, club.description, club.location, club.contact_email, club.website, club.meetup_day, club.meetup_time, createdBy]
    );
    const clubId = rows[0].id;
    clubCount++;

    const runs = buildRunsForClub(club);
    for (const run of runs) {
      await pool.query(
        `INSERT INTO run_metadata
           (weekday, start_times, meetup_location, address_intersection, average_distance, terrain, pace_groups, latitude, longitude, club_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [run.weekday, run.start_times, run.meetup_location, run.address_intersection, run.average_distance, run.terrain, run.pace_groups, run.latitude, run.longitude, clubId, run.created_at]
      );
      runCount++;
    }
  }

  console.log(`Seeded ${clubCount} clubs and ${runCount} runs.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
