CREATE TABLE IF NOT EXISTS run_metadata (
  id SERIAL PRIMARY KEY,
  weekday TEXT,
  start_times TEXT,
  meetup_location TEXT,
  address_intersection TEXT,
  average_distance TEXT,
  terrain TEXT,
  pace_groups TEXT
);

INSERT INTO run_metadata (id, weekday, start_times, meetup_location, address_intersection, average_distance, terrain, pace_groups) VALUES (1, 'Sunday', '7 AM', 'Boardwalk', 'Ocean Ave & Main Street - Ocean Grove NJ', '3 to 10+ Miles', 'Road (Boardwalk)', 'Not specified');
INSERT INTO run_metadata (id, weekday, start_times, meetup_location, address_intersection, average_distance, terrain, pace_groups) VALUES (2, 'Tuesday', '6 PM', 'Southern Boardwalk Entrance', 'Ocean Ave & Brighton Avenue - Long Branch NJ', '4 to 6 Miles', 'Road (Boardwalk)', 'Not specified');
INSERT INTO run_metadata (id, weekday, start_times, meetup_location, address_intersection, average_distance, terrain, pace_groups) VALUES (3, 'Wednesday', '6 PM', 'Boardwalk', 'Ocean Ave & Main Street - Ocean Grove NJ', '3 to 10+ Miles', 'Road (Boardwalk)', 'Not specified');
INSERT INTO run_metadata (id, weekday, start_times, meetup_location, address_intersection, average_distance, terrain, pace_groups) VALUES (4, 'Thursday', '6 AM', 'Boardwalk', 'Ocean Ave & 16th Ave - Belmar NJ', '3 to 10+ Miles', 'Road (Boardwalk)', 'Not specified');
INSERT INTO run_metadata (id, weekday, start_times, meetup_location, address_intersection, average_distance, terrain, pace_groups) VALUES (5, 'Thursday', '6 PM', 'Convention Hall / North End Pavilion', 'Asbury Park Convention Hall / Spring Lake North End Pavilion (varies seasonally: Nov-May Asbury Park, May-Nov Spring Lake)', '4 to 6+ Miles', 'Road (Boardwalk)', 'Not specified');

SELECT setval('run_metadata_id_seq', (SELECT MAX(id) FROM run_metadata));
