-- doorlog(eventid,doorid,tim,username,event)

-- 1. How many users entered through doorid=1
SELECT COUNT(DISTINCT username) FROM doorlog WHERE event = 'E' AND doorid = 1;

-- 2. If doorid=2 is bathroom, how many people are currently in the bathroom?
WITH latest AS (
    SELECT DISTINCT ON (username) username, event
    FROM doorlog
    WHERE doorid = 2
    ORDER BY username, tim DESC, eventid DESC
)
SELECT COUNT(*) FROM latest WHERE event = 'E';

-- Introduce a view:
-- Assume complete logs that alternate E/X within each (username, zone), beginning with E;
-- only the final E may be unmatched. Events are ordered by (tim, eventid), with
-- unique eventid breaking equal-timestamp ties. Under this contract, NULL exit means still inside.
CREATE VIEW presence AS
WITH events AS (
  SELECT
    eventid,
    username,
    tim,
    event,
    -- Door-to-zone mapping: Zone 0 = building (doors 1 and 3); any other door is its own zone.
    CASE WHEN doorid IN (1, 3) THEN 0 ELSE doorid END AS zone
  FROM doorlog
),
sequenced AS (
  SELECT
    *,
    LEAD(event) OVER w AS next_event,
    LEAD(tim)   OVER w AS next_tim
  FROM events
  WINDOW w AS (PARTITION BY username, zone ORDER BY tim, eventid)
)
SELECT
  username,
  zone,
  tim AS entry,
  CASE WHEN next_event = 'X' THEN next_tim END AS "exit"
FROM sequenced
WHERE event = 'E';

-- 2b. If doorid=2 is bathroom, how many people are currently in the bathroom?
SELECT COUNT(DISTINCT username) FROM presence WHERE exit IS NULL AND zone = 2;

-- 3. If doorid=1 is front entrance door, and doorid=3 is back entrance door, and these are the only doors in the building, how many people are currently in the building?
SELECT COUNT(DISTINCT username) FROM presence WHERE exit IS NULL AND zone = 0;

-- 4. How many people were in the building on July 4th, at 10PM? (watching fireworks)
SELECT COUNT(distinct username)
FROM presence AS p
WHERE p.zone = 0
AND TIMESTAMP '2024-07-04 22:00' BETWEEN p.entry AND COALESCE(p.exit, 'infinity');

-- Introduce an occupancy view with one row per (day, zone, username).
-- A row represents any presence that day, including overnight carryovers, with
-- entry counts and outer stay endpoints clipped to the day. Departure is inclusive:
-- an exit at midnight also touches the following day. Unclosed stays extend through LOCALTIMESTAMP.

CREATE VIEW occupancy AS
WITH days AS (
  SELECT g::date AS day
  FROM generate_series(
         (SELECT MIN(entry)::date FROM presence),
         CURRENT_DATE,
         interval '1 day'
       ) AS g
),
stays AS (
  SELECT
    username,
    zone,
    entry,
    COALESCE("exit", LOCALTIMESTAMP) AS leave,
    "exit" IS NULL AS is_open
  FROM presence
)
SELECT
  d.day,
  s.zone,
  s.username,
  COUNT(*) FILTER (WHERE s.entry::date = d.day)  AS entries,     -- stays that began that day
  MAX(LEAST(s.leave, (d.day + 1)::timestamp))    AS last_exit,   -- clipped to day's end; the overlap join below creates carryover rows
  MIN(GREATEST(s.entry, d.day::timestamp))       AS first_entry, -- clipped to the day, so that they count as in the room at midnight
  BOOL_OR(s.is_open)                             AS is_open      -- a stay with no recorded exit touches the day
FROM days AS d
JOIN stays AS s
  ON s.entry < (d.day + 1)::timestamp
 AND s.leave >= d.day::timestamp
GROUP BY d.day, s.zone, s.username;

-- 5. If doorid=7 is for floor 42, what's the daily occupancy of floor 42 for entire 2021 (give a number for every day in 2021; not just days that had activity; if nobody entered/left floor, then return 0 for that day)
SELECT g::date AS day, COUNT(o.username) AS occupancy
FROM generate_series('2021-01-01'::date, '2021-12-31'::date, interval '1 day') AS g
LEFT JOIN occupancy AS o ON o.day = g::date AND o.zone = 7
GROUP BY 1
ORDER BY 1;

-- 6. What is the daily average (and standard deveation) occupancy of floor 42 for 2021? (single number; use above question results)
WITH daily AS (
    SELECT g::date AS day, COUNT(o.username) AS occupancy
    FROM generate_series('2021-01-01'::date, '2021-12-31'::date, interval '1 day') AS g
    LEFT JOIN occupancy AS o ON o.day = g::date AND o.zone = 7
    GROUP BY 1
    ORDER BY 1
)
SELECT AVG(occupancy), STDDEV_SAMP(occupancy) FROM daily;

-- 7. What percentage of the people work on floor 42 (assume if they entered the floor, they work there).
SELECT 100.0 * COUNT(DISTINCT username) FILTER (WHERE zone = 7)
             / NULLIF(COUNT(DISTINCT username), 0) AS pct_floor_42
FROM presence;

-- 8. What's the average number of times per day that people use the bathroom? (bathroom is doorid=2).
-- Observation window: every calendar day from the first doorlog event through CURRENT_DATE.
WITH days AS (
  SELECT g::date AS day
  FROM generate_series(
         (SELECT MIN(tim)::date FROM doorlog),
         CURRENT_DATE,
         interval '1 day'
       ) AS g
),
daily_entries AS (
  SELECT tim::date AS day, COUNT(*) AS entries
  FROM doorlog
  WHERE doorid = 2 AND event = 'E'
  GROUP BY tim::date
)
SELECT AVG(COALESCE(e.entries, 0))
FROM days AS d
LEFT JOIN daily_entries AS e ON e.day = d.day;

-- 9. What percentage of employees stayed after 5:15PM on July 3rd, 2022?
SELECT 100.0 * COUNT(*) FILTER (WHERE last_exit > TIMESTAMP '2022-07-03 17:15')
             / NULLIF(COUNT(*), 0) AS pct_stayed
FROM occupancy AS o
WHERE o.zone = 0
  AND o.day = '2022-07-03'
  AND EXISTS (
    SELECT 1
    FROM presence AS p
    WHERE p.username = o.username
      AND p.zone = 0
      AND p.entry::date = o.day
      AND p.entry < TIMESTAMP '2022-07-03 17:15'
  );

-- 10. List all employees who left work before 1PM on July 3rd, 2022 (assume they arrived to work on July 3rd, before 1pm).
SELECT username
FROM occupancy
WHERE zone = 0
  AND day = '2022-07-03'
  AND NOT is_open
  AND last_exit < '2022-07-03 13:00';
