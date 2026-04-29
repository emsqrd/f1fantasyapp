-- ============================================================================
-- Test Data Generation: Lineups for Rounds 1-3 of the 2026 Season
-- ============================================================================
-- Creates persistent rosters (TeamDrivers + TeamConstructors) and per-race
-- LineupEntry rows for the first three RaceWeekends of the 2026 season for:
--   - The 10 generated test teams from test-data-teams.sql
--   - 'Sainz of Time' (created externally with a real user)
--
-- Also adds 'Sainz of Time' to the 'Paddock Pretenders' league (idempotent).
--
-- Preconditions:
--   1. seed.sql + seed-prices.sql have been run (Drivers, Constructors, Seasons,
--      RaceWeekends 2026 rounds 1-3, and prices are loaded).
--   2. test-data-teams.sql has been run (10 test teams + Paddock Pretenders league).
--   3. A team named exactly 'Sainz of Time' exists, owned by a real user.
--
-- Lineup design notes:
--   - All 11 lineups are budget-cap compliant (<= $100M / 100,000,000 raw units).
--   - Each lineup respects composition intent: <= 3 elite (>=$22M) assets.
--   - Same lineup and captain are used across rounds 1-3 (transfers not modeled).
--   - Driver slot positions: 0-4. Constructor slot positions: 0-1.
--     (Matches the API's TeamService validation, which is zero-indexed.)
--   - Captain is the slot-0 driver on each team (IsCaptain = true on exactly
--     one LineupEntry per team per race; constructors are never captain).
--
-- Scoring/ingestion ordering:
--   1. Run this script.
--   2. Run results ingestion (DriverQualifyingResult, DriverRacingResult).
--   3. Run scoring (DriverRaceWeekendScore, ConstructorRaceWeekendScore,
--      TeamRaceWeekendScore).
--
-- Transaction Support:
-- - Change ROLLBACK to COMMIT at the end to persist.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Cleanup (allows re-running this script)
-- ============================================================================
-- Scoped to our 11 teams. For test teams, test-data-teams.sql re-cleanup
-- cascades these tables anyway when it deletes the Teams; this block is the
-- safety net for re-running test-data-lineups.sql in isolation, and is the
-- ONLY path that cleans up rows for the externally-created 'Sainz of Time'.

DELETE FROM "LineupEntries"
WHERE "TeamId" IN (
  SELECT t."Id"
  FROM "Teams" t
  LEFT JOIN "UserProfiles" up ON t."UserId" = up."Id"
  WHERE up."Email" LIKE '%testteam%@f1fantasy.test'
     OR t."Name" = 'Sainz of Time'
)
AND "RaceWeekendId" IN (
  SELECT rw."Id"
  FROM "RaceWeekends" rw
  INNER JOIN "Seasons" s ON rw."SeasonId" = s."Id"
  WHERE s."Year" = 2026 AND rw."Round" IN (1, 2, 3)
);

DELETE FROM "TeamDrivers"
WHERE "TeamId" IN (
  SELECT t."Id"
  FROM "Teams" t
  LEFT JOIN "UserProfiles" up ON t."UserId" = up."Id"
  WHERE up."Email" LIKE '%testteam%@f1fantasy.test'
     OR t."Name" = 'Sainz of Time'
);

DELETE FROM "TeamConstructors"
WHERE "TeamId" IN (
  SELECT t."Id"
  FROM "Teams" t
  LEFT JOIN "UserProfiles" up ON t."UserId" = up."Id"
  WHERE up."Email" LIKE '%testteam%@f1fantasy.test'
     OR t."Name" = 'Sainz of Time'
);

-- ============================================================================
-- Step 1: Add 'Sainz of Time' to the Paddock Pretenders league
-- ============================================================================
-- No-op if already a member. Skipped silently if either the team or the league
-- is missing (no rows to insert).
INSERT INTO "LeagueTeams" ("LeagueId", "TeamId", "JoinedAt", "CreatedBy", "CreatedAt", "UpdatedAt", "DeletedAt", "IsDeleted", "UpdatedBy", "DeletedBy")
SELECT
  l."Id" as "LeagueId",
  t."Id" as "TeamId",
  NOW() as "JoinedAt",
  t."UserId" as "CreatedBy",
  NOW() as "CreatedAt",
  NOW() as "UpdatedAt",
  NULL as "DeletedAt",
  false as "IsDeleted",
  NULL as "UpdatedBy",
  NULL as "DeletedBy"
FROM "Teams" t
CROSS JOIN "Leagues" l
WHERE t."Name" = 'Sainz of Time'
  AND l."Name" = 'Paddock Pretenders'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 2: Insert TeamDrivers (persistent driver rosters)
-- ============================================================================
-- Composition: 5 unique drivers per team. Total roster cost (drivers + constructors)
-- per team is shown in the comments; budget cap = 100.0M.

WITH driver_data (team_name, slot, driver_abbr) AS (
  VALUES
    -- Red Bull Rivals — Verstappen-led, value support (77.8M total)
    ('Red Bull Rivals', 0, 'VER'),
    ('Red Bull Rivals', 1, 'HAD'),
    ('Red Bull Rivals', 2, 'HUL'),
    ('Red Bull Rivals', 3, 'GAS'),
    ('Red Bull Rivals', 4, 'COL'),

    -- Verstappen's Victory — top-heavy drivers, bargain constructors (83.0M)
    ('Verstappen''s Victory', 0, 'VER'),
    ('Verstappen''s Victory', 1, 'NOR'),
    ('Verstappen''s Victory', 2, 'HAM'),
    ('Verstappen''s Victory', 3, 'STR'),
    ('Verstappen''s Victory', 4, 'GAS'),

    -- Monza Mavericks — Ferrari + Aston balanced (71.6M)
    ('Monza Mavericks', 0, 'LEC'),
    ('Monza Mavericks', 1, 'HAM'),
    ('Monza Mavericks', 2, 'SAI'),
    ('Monza Mavericks', 3, 'ALO'),
    ('Monza Mavericks', 4, 'STR'),

    -- Ferrari Fanatics — Ferrari core + Verstappen wildcard (90.2M)
    ('Ferrari Fanatics', 0, 'LEC'),
    ('Ferrari Fanatics', 1, 'HAM'),
    ('Ferrari Fanatics', 2, 'VER'),
    ('Ferrari Fanatics', 3, 'HAD'),
    ('Ferrari Fanatics', 4, 'HUL'),

    -- Hamilton Heroes — Mercedes-flavoured (86.4M)
    ('Hamilton Heroes', 0, 'HAM'),
    ('Hamilton Heroes', 1, 'RUS'),
    ('Hamilton Heroes', 2, 'ANT'),
    ('Hamilton Heroes', 3, 'ALB'),
    ('Hamilton Heroes', 4, 'OCO'),

    -- Silverstone Speedsters — British-driver heavy (95.2M)
    ('Silverstone Speedsters', 0, 'NOR'),
    ('Silverstone Speedsters', 1, 'HAM'),
    ('Silverstone Speedsters', 2, 'RUS'),
    ('Silverstone Speedsters', 3, 'ALB'),
    ('Silverstone Speedsters', 4, 'BEA'),

    -- McLaren Masters — Piastri-led with cheap drivers to fund MCL (86.7M)
    ('McLaren Masters', 0, 'PIA'),
    ('McLaren Masters', 1, 'HAD'),
    ('McLaren Masters', 2, 'GAS'),
    ('McLaren Masters', 3, 'STR'),
    ('McLaren Masters', 4, 'COL'),

    -- Norris Navigators — Norris + diverse mid-range (98.1M)
    ('Norris Navigators', 0, 'NOR'),
    ('Norris Navigators', 1, 'HAD'),
    ('Norris Navigators', 2, 'HAM'),
    ('Norris Navigators', 3, 'ALB'),
    ('Norris Navigators', 4, 'HUL'),

    -- Spa Specialists — Verstappen + underdog mix (79.8M)
    ('Spa Specialists', 0, 'VER'),
    ('Spa Specialists', 1, 'ALO'),
    ('Spa Specialists', 2, 'ALB'),
    ('Spa Specialists', 3, 'GAS'),
    ('Spa Specialists', 4, 'BEA'),

    -- Mercedes Maniacs — full Merc lineup + Hamilton (83.0M)
    ('Mercedes Maniacs', 0, 'RUS'),
    ('Mercedes Maniacs', 1, 'ANT'),
    ('Mercedes Maniacs', 2, 'HAM'),
    ('Mercedes Maniacs', 3, 'HAD'),
    ('Mercedes Maniacs', 4, 'STR'),

    -- Sainz of Time — Sainz-flavoured with Ferrari/RB power (95.3M)
    ('Sainz of Time', 0, 'SAI'),
    ('Sainz of Time', 1, 'VER'),
    ('Sainz of Time', 2, 'LEC'),
    ('Sainz of Time', 3, 'HAD'),
    ('Sainz of Time', 4, 'ALB')
)
INSERT INTO "TeamDrivers" ("TeamId", "DriverId", "SlotPosition", "CreatedBy", "CreatedAt", "UpdatedAt", "DeletedAt", "IsDeleted", "UpdatedBy", "DeletedBy")
SELECT
  t."Id" as "TeamId",
  d."Id" as "DriverId",
  dd.slot as "SlotPosition",
  t."UserId" as "CreatedBy",
  NOW() as "CreatedAt",
  NOW() as "UpdatedAt",
  NULL as "DeletedAt",
  false as "IsDeleted",
  NULL as "UpdatedBy",
  NULL as "DeletedBy"
FROM driver_data dd
INNER JOIN "Teams" t ON t."Name" = dd.team_name
INNER JOIN "Drivers" d ON d."Abbreviation" = dd.driver_abbr;

-- ============================================================================
-- Step 3: Insert TeamConstructors (persistent constructor rosters)
-- ============================================================================
WITH constructor_data (team_name, slot, constructor_abbr) AS (
  VALUES
    ('Red Bull Rivals', 0, 'RBR'),
    ('Red Bull Rivals', 1, 'HAA'),
    ('Verstappen''s Victory', 0, 'ALP'),
    ('Verstappen''s Victory', 1, 'CAD'),
    ('Monza Mavericks', 0, 'FER'),
    ('Monza Mavericks', 1, 'AMR'),
    ('Ferrari Fanatics', 0, 'FER'),
    ('Ferrari Fanatics', 1, 'CAD'),
    ('Hamilton Heroes', 0, 'MER'),
    ('Hamilton Heroes', 1, 'AMR'),
    ('Silverstone Speedsters', 0, 'WIL'),
    ('Silverstone Speedsters', 1, 'HAA'),
    ('McLaren Masters', 0, 'MCL'),
    ('McLaren Masters', 1, 'AMR'),
    ('Norris Navigators', 0, 'MCL'),
    ('Norris Navigators', 1, 'CAD'),
    ('Spa Specialists', 0, 'RBR'),
    ('Spa Specialists', 1, 'AUD'),
    ('Mercedes Maniacs', 0, 'MER'),
    ('Mercedes Maniacs', 1, 'RBS'),
    ('Sainz of Time', 0, 'WIL'),
    ('Sainz of Time', 1, 'RBR')
)
INSERT INTO "TeamConstructors" ("TeamId", "ConstructorId", "SlotPosition", "CreatedBy", "CreatedAt", "UpdatedAt", "DeletedAt", "IsDeleted", "UpdatedBy", "DeletedBy")
SELECT
  t."Id" as "TeamId",
  c."Id" as "ConstructorId",
  cd.slot as "SlotPosition",
  t."UserId" as "CreatedBy",
  NOW() as "CreatedAt",
  NOW() as "UpdatedAt",
  NULL as "DeletedAt",
  false as "IsDeleted",
  NULL as "UpdatedBy",
  NULL as "DeletedBy"
FROM constructor_data cd
INNER JOIN "Teams" t ON t."Name" = cd.team_name
INNER JOIN "Constructors" c ON c."Abbreviation" = cd.constructor_abbr;

-- ============================================================================
-- Step 4: Insert LineupEntries for rounds 1-3
-- ============================================================================
-- Driver entries (EntityType = 0). The slot-0 driver is captain for every team.
WITH our_teams AS (
  SELECT "Id"
  FROM "Teams"
  WHERE "Name" IN (
    'Red Bull Rivals', 'Verstappen''s Victory', 'Monza Mavericks',
    'Ferrari Fanatics', 'Hamilton Heroes', 'Silverstone Speedsters',
    'McLaren Masters', 'Norris Navigators', 'Spa Specialists',
    'Mercedes Maniacs', 'Sainz of Time'
  )
),
target_races AS (
  SELECT rw."Id" as race_weekend_id
  FROM "RaceWeekends" rw
  INNER JOIN "Seasons" s ON rw."SeasonId" = s."Id"
  WHERE s."Year" = 2026 AND rw."Round" IN (1, 2, 3)
)
INSERT INTO "LineupEntries" ("TeamId", "RaceWeekendId", "EntityId", "EntityType", "SlotPosition", "IsCaptain", "CreatedAt")
SELECT
  td."TeamId",
  tr.race_weekend_id as "RaceWeekendId",
  td."DriverId" as "EntityId",
  0 as "EntityType",
  td."SlotPosition",
  (td."SlotPosition" = 0) as "IsCaptain",
  NOW() as "CreatedAt"
FROM "TeamDrivers" td
INNER JOIN our_teams ot ON ot."Id" = td."TeamId"
CROSS JOIN target_races tr;

-- Constructor entries (EntityType = 1). Constructors are never captain.
WITH our_teams AS (
  SELECT "Id"
  FROM "Teams"
  WHERE "Name" IN (
    'Red Bull Rivals', 'Verstappen''s Victory', 'Monza Mavericks',
    'Ferrari Fanatics', 'Hamilton Heroes', 'Silverstone Speedsters',
    'McLaren Masters', 'Norris Navigators', 'Spa Specialists',
    'Mercedes Maniacs', 'Sainz of Time'
  )
),
target_races AS (
  SELECT rw."Id" as race_weekend_id
  FROM "RaceWeekends" rw
  INNER JOIN "Seasons" s ON rw."SeasonId" = s."Id"
  WHERE s."Year" = 2026 AND rw."Round" IN (1, 2, 3)
)
INSERT INTO "LineupEntries" ("TeamId", "RaceWeekendId", "EntityId", "EntityType", "SlotPosition", "IsCaptain", "CreatedAt")
SELECT
  tc."TeamId",
  tr.race_weekend_id as "RaceWeekendId",
  tc."ConstructorId" as "EntityId",
  1 as "EntityType",
  tc."SlotPosition",
  false as "IsCaptain",
  NOW() as "CreatedAt"
FROM "TeamConstructors" tc
INNER JOIN our_teams ot ON ot."Id" = tc."TeamId"
CROSS JOIN target_races tr;

-- ============================================================================
-- Verification queries (uncomment to inspect)
-- ============================================================================

-- Roster cost check (should all be <= 100,000,000)
SELECT
  t."Name",
  (SELECT COALESCE(SUM(d."Price"), 0)
     FROM "TeamDrivers" td
     INNER JOIN "Drivers" d ON d."Id" = td."DriverId"
     WHERE td."TeamId" = t."Id") AS driver_cost,
  (SELECT COALESCE(SUM(c."Price"), 0)
     FROM "TeamConstructors" tc
     INNER JOIN "Constructors" c ON c."Id" = tc."ConstructorId"
     WHERE tc."TeamId" = t."Id") AS constructor_cost,
  (SELECT COALESCE(SUM(d."Price"), 0)
     FROM "TeamDrivers" td
     INNER JOIN "Drivers" d ON d."Id" = td."DriverId"
     WHERE td."TeamId" = t."Id")
  + (SELECT COALESCE(SUM(c."Price"), 0)
     FROM "TeamConstructors" tc
     INNER JOIN "Constructors" c ON c."Id" = tc."ConstructorId"
     WHERE tc."TeamId" = t."Id") AS total_cost
FROM "Teams" t
WHERE t."Name" IN (
  'Red Bull Rivals', 'Verstappen''s Victory', 'Monza Mavericks',
  'Ferrari Fanatics', 'Hamilton Heroes', 'Silverstone Speedsters',
  'McLaren Masters', 'Norris Navigators', 'Spa Specialists',
  'Mercedes Maniacs', 'Sainz of Time'
)
ORDER BY t."Name";

-- LineupEntry counts per team (each team should have 7 entries x 3 races = 21)
SELECT
  t."Name",
  COUNT(*) FILTER (WHERE le."EntityType" = 0) AS driver_entries,
  COUNT(*) FILTER (WHERE le."EntityType" = 1) AS constructor_entries,
  COUNT(*) FILTER (WHERE le."IsCaptain") AS captain_entries
FROM "Teams" t
INNER JOIN "LineupEntries" le ON le."TeamId" = t."Id"
INNER JOIN "RaceWeekends" rw ON rw."Id" = le."RaceWeekendId"
INNER JOIN "Seasons" s ON s."Id" = rw."SeasonId"
WHERE t."Name" IN (
  'Red Bull Rivals', 'Verstappen''s Victory', 'Monza Mavericks',
  'Ferrari Fanatics', 'Hamilton Heroes', 'Silverstone Speedsters',
  'McLaren Masters', 'Norris Navigators', 'Spa Specialists',
  'Mercedes Maniacs', 'Sainz of Time'
)
  AND s."Year" = 2026
  AND rw."Round" IN (1, 2, 3)
GROUP BY t."Name"
ORDER BY t."Name";

-- ============================================================================
-- Commit (change to COMMIT to persist; ROLLBACK is the safe default)
-- ============================================================================
ROLLBACK;
-- COMMIT;
