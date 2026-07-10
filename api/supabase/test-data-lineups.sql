-- ============================================================================
-- Test Data Generation: Lineups for Rounds 1-5 of the 2026 Season
-- ============================================================================
-- Creates persistent lineups (TeamDrivers + TeamConstructors) and per-race
-- LineupEntry rows for the first five RaceWeekends of the 2026 season for:
--   - The 10 generated test teams from test-data-teams.sql
--   - 'Sainz of Trouble' (created externally with a real user)
--
-- Also adds 'Sainz of Trouble' to the 'Paddock Pretenders' league (idempotent).
--
-- Preconditions:
--   1. seed.sql + seed-prices.sql have been run (Drivers, Constructors, Seasons,
--      RaceWeekends 2026 rounds 1-5, and prices are loaded).
--   2. test-data-teams.sql has been run (10 test teams + Paddock Pretenders league).
--   3. A team named exactly 'Sainz of Trouble' exists, owned by a real user.
--
-- Lineup design notes:
--   - All 11 lineups are budget-cap compliant (<= $100M / 100,000,000 raw units)
--     at every round (using round-1 prices as the budget reference).
--   - Each lineup respects composition intent: <= 3 elite (>=$22M) assets.
--   - Driver lineups vary across rounds: some teams swap a driver mid-season
--     (modeled as a per-round entry, not a "transfer" event), and several teams
--     rotate captain across rounds to produce week-over-week leaderboard movement.
--   - Constructor lineups are stable across all 5 rounds in this draft.
--   - Driver slot positions: 0-4. Constructor slot positions: 0-1.
--     (Matches the API's TeamService validation, which is zero-indexed.)
--   - Exactly one IsCaptain = true per team per race; constructors are never captain.
--   - TeamDrivers (the "current lineup") reflects each team's round-5 driver per
--     slot, since it naturally tracks the most recent lineup.
--
-- Implementation notes:
--   - Names/abbreviations are resolved to IDs once via lookup temp tables at the
--     top of the script. Every downstream join is on integer/uuid IDs, not text.
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
-- Lookup tables: resolve names/abbreviations to IDs once
-- ============================================================================
-- Every downstream INSERT joins on integer/uuid IDs from these tables instead
-- of repeating text-based joins against "Teams"."Name" etc. Column types are
-- inferred from the source columns.
--
-- teams_to_clean is broader than team_lookup: it includes every test team by
-- email pattern (so the cleanup still works if a team got renamed) plus the
-- externally-created 'Sainz of Trouble' team.

CREATE TEMP TABLE teams_to_clean ON COMMIT DROP AS
SELECT t."Id" AS team_id
FROM "Teams" t
LEFT JOIN "UserProfiles" up ON t."UserId" = up."Id"
WHERE up."Email" LIKE '%testteam%@f1fantasy.test'
   OR t."Name" = 'Sainz of Trouble';

CREATE TEMP TABLE team_lookup ON COMMIT DROP AS
SELECT t."Id" AS team_id, t."UserId" AS user_id, t."Name" AS team_name
FROM "Teams" t
WHERE t."Name" IN (
  'Red Bull Rivals', 'Verstappen''s Victory', 'Monza Mavericks',
  'Ferrari Fanatics', 'Hamilton Heroes', 'Silverstone Speedsters',
  'McLaren Masters', 'Norris Navigators', 'Spa Specialists',
  'Mercedes Maniacs', 'Sainz of Trouble'
);

CREATE TEMP TABLE race_weekend_lookup ON COMMIT DROP AS
SELECT rw."Id" AS race_weekend_id, rw."Round" AS round
FROM "RaceWeekends" rw
INNER JOIN "Seasons" s ON s."Id" = rw."SeasonId"
WHERE s."Year" = 2026 AND rw."Round" <= 5;

CREATE TEMP TABLE driver_lookup ON COMMIT DROP AS
SELECT d."Id" AS driver_id, d."Abbreviation" AS abbreviation
FROM "Drivers" d;

CREATE TEMP TABLE constructor_lookup ON COMMIT DROP AS
SELECT c."Id" AS constructor_id, c."Abbreviation" AS abbreviation
FROM "Constructors" c;

-- ============================================================================
-- Cleanup (allows re-running this script)
-- ============================================================================
-- For test teams, test-data-teams.sql re-cleanup cascades these tables anyway
-- when it deletes the Teams; this block is the safety net for re-running
-- test-data-lineups.sql in isolation, and is the ONLY path that cleans up rows
-- for the externally-created 'Sainz of Trouble'.

DELETE FROM "LineupEntries"
WHERE "TeamId" IN (SELECT team_id FROM teams_to_clean)
  AND "RaceWeekendId" IN (SELECT race_weekend_id FROM race_weekend_lookup);

DELETE FROM "TeamDrivers"
WHERE "TeamId" IN (SELECT team_id FROM teams_to_clean);

DELETE FROM "TeamConstructors"
WHERE "TeamId" IN (SELECT team_id FROM teams_to_clean);

-- ============================================================================
-- Step 1: Add 'Sainz of Trouble' to the Paddock Pretenders league
-- ============================================================================
-- No-op if already a member. Skipped silently if either the team or the league
-- is missing (no rows to insert).
INSERT INTO "LeagueTeams" ("LeagueId", "TeamId", "JoinedAt", "CreatedBy", "CreatedAt", "IsDeleted")
SELECT
  l."Id" AS "LeagueId",
  tl.team_id AS "TeamId",
  NOW() AS "JoinedAt",
  tl.user_id AS "CreatedBy",
  NOW() AS "CreatedAt",
  false AS "IsDeleted"
FROM team_lookup tl
CROSS JOIN "Leagues" l
WHERE tl.team_name = 'Sainz of Trouble'
  AND l."Name" = 'Paddock Pretenders'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 2: Per-round driver lineups (drives both TeamDrivers and LineupEntries)
-- ============================================================================
-- One row per (team, round, slot). is_captain marks the captain for that race
-- (exactly one per team per round). Rounds where a slot's driver differs from
-- the previous round represent a mid-season swap.
--
-- Names and abbreviations in the VALUES list are resolved to IDs during this
-- INSERT; the resulting temp table holds only IDs.

CREATE TEMP TABLE driver_lineups ON COMMIT DROP AS
SELECT tl.team_id, v.round, v.slot, dl.driver_id, v.is_captain
FROM (VALUES
  -- ============== Red Bull Rivals ==============
  -- Swap: R3 slot 1 HAD -> ANT. Captain VER all rounds.
  ('Red Bull Rivals', 1, 0, 'VER', true),
  ('Red Bull Rivals', 1, 1, 'HAD', false),
  ('Red Bull Rivals', 1, 2, 'HUL', false),
  ('Red Bull Rivals', 1, 3, 'GAS', false),
  ('Red Bull Rivals', 1, 4, 'COL', false),
  ('Red Bull Rivals', 2, 0, 'VER', true),
  ('Red Bull Rivals', 2, 1, 'HAD', false),
  ('Red Bull Rivals', 2, 2, 'HUL', false),
  ('Red Bull Rivals', 2, 3, 'GAS', false),
  ('Red Bull Rivals', 2, 4, 'COL', false),
  ('Red Bull Rivals', 3, 0, 'VER', true),
  ('Red Bull Rivals', 3, 1, 'ANT', false),
  ('Red Bull Rivals', 3, 2, 'HUL', false),
  ('Red Bull Rivals', 3, 3, 'GAS', false),
  ('Red Bull Rivals', 3, 4, 'COL', false),
  ('Red Bull Rivals', 4, 0, 'VER', true),
  ('Red Bull Rivals', 4, 1, 'ANT', false),
  ('Red Bull Rivals', 4, 2, 'HUL', false),
  ('Red Bull Rivals', 4, 3, 'GAS', false),
  ('Red Bull Rivals', 4, 4, 'COL', false),
  ('Red Bull Rivals', 5, 0, 'VER', true),
  ('Red Bull Rivals', 5, 1, 'ANT', false),
  ('Red Bull Rivals', 5, 2, 'HUL', false),
  ('Red Bull Rivals', 5, 3, 'GAS', false),
  ('Red Bull Rivals', 5, 4, 'COL', false),

  -- ============== Verstappen's Victory ==============
  -- Swap: R4 slot 4 GAS -> BEA. Captain rotates: R1 VER, R2 NOR, R3 VER, R4 HAM, R5 VER.
  ('Verstappen''s Victory', 1, 0, 'VER', true),
  ('Verstappen''s Victory', 1, 1, 'NOR', false),
  ('Verstappen''s Victory', 1, 2, 'HAM', false),
  ('Verstappen''s Victory', 1, 3, 'STR', false),
  ('Verstappen''s Victory', 1, 4, 'GAS', false),
  ('Verstappen''s Victory', 2, 0, 'VER', false),
  ('Verstappen''s Victory', 2, 1, 'NOR', true),
  ('Verstappen''s Victory', 2, 2, 'HAM', false),
  ('Verstappen''s Victory', 2, 3, 'STR', false),
  ('Verstappen''s Victory', 2, 4, 'GAS', false),
  ('Verstappen''s Victory', 3, 0, 'VER', true),
  ('Verstappen''s Victory', 3, 1, 'NOR', false),
  ('Verstappen''s Victory', 3, 2, 'HAM', false),
  ('Verstappen''s Victory', 3, 3, 'STR', false),
  ('Verstappen''s Victory', 3, 4, 'GAS', false),
  ('Verstappen''s Victory', 4, 0, 'VER', false),
  ('Verstappen''s Victory', 4, 1, 'NOR', false),
  ('Verstappen''s Victory', 4, 2, 'HAM', true),
  ('Verstappen''s Victory', 4, 3, 'STR', false),
  ('Verstappen''s Victory', 4, 4, 'BEA', false),
  ('Verstappen''s Victory', 5, 0, 'VER', true),
  ('Verstappen''s Victory', 5, 1, 'NOR', false),
  ('Verstappen''s Victory', 5, 2, 'HAM', false),
  ('Verstappen''s Victory', 5, 3, 'STR', false),
  ('Verstappen''s Victory', 5, 4, 'BEA', false),

  -- ============== Monza Mavericks ==============
  -- No driver swaps. Captain rotates: R3 captain HAM, else LEC.
  ('Monza Mavericks', 1, 0, 'LEC', true),
  ('Monza Mavericks', 1, 1, 'HAM', false),
  ('Monza Mavericks', 1, 2, 'SAI', false),
  ('Monza Mavericks', 1, 3, 'ALO', false),
  ('Monza Mavericks', 1, 4, 'STR', false),
  ('Monza Mavericks', 2, 0, 'LEC', true),
  ('Monza Mavericks', 2, 1, 'HAM', false),
  ('Monza Mavericks', 2, 2, 'SAI', false),
  ('Monza Mavericks', 2, 3, 'ALO', false),
  ('Monza Mavericks', 2, 4, 'STR', false),
  ('Monza Mavericks', 3, 0, 'LEC', false),
  ('Monza Mavericks', 3, 1, 'HAM', true),
  ('Monza Mavericks', 3, 2, 'SAI', false),
  ('Monza Mavericks', 3, 3, 'ALO', false),
  ('Monza Mavericks', 3, 4, 'STR', false),
  ('Monza Mavericks', 4, 0, 'LEC', true),
  ('Monza Mavericks', 4, 1, 'HAM', false),
  ('Monza Mavericks', 4, 2, 'SAI', false),
  ('Monza Mavericks', 4, 3, 'ALO', false),
  ('Monza Mavericks', 4, 4, 'STR', false),
  ('Monza Mavericks', 5, 0, 'LEC', true),
  ('Monza Mavericks', 5, 1, 'HAM', false),
  ('Monza Mavericks', 5, 2, 'SAI', false),
  ('Monza Mavericks', 5, 3, 'ALO', false),
  ('Monza Mavericks', 5, 4, 'STR', false),

  -- ============== Ferrari Fanatics ==============
  -- Swap: R3 slot 4 HUL -> ANT. Captain LEC all rounds.
  ('Ferrari Fanatics', 1, 0, 'LEC', true),
  ('Ferrari Fanatics', 1, 1, 'HAM', false),
  ('Ferrari Fanatics', 1, 2, 'VER', false),
  ('Ferrari Fanatics', 1, 3, 'HAD', false),
  ('Ferrari Fanatics', 1, 4, 'HUL', false),
  ('Ferrari Fanatics', 2, 0, 'LEC', true),
  ('Ferrari Fanatics', 2, 1, 'HAM', false),
  ('Ferrari Fanatics', 2, 2, 'VER', false),
  ('Ferrari Fanatics', 2, 3, 'HAD', false),
  ('Ferrari Fanatics', 2, 4, 'HUL', false),
  ('Ferrari Fanatics', 3, 0, 'LEC', true),
  ('Ferrari Fanatics', 3, 1, 'HAM', false),
  ('Ferrari Fanatics', 3, 2, 'VER', false),
  ('Ferrari Fanatics', 3, 3, 'HAD', false),
  ('Ferrari Fanatics', 3, 4, 'ANT', false),
  ('Ferrari Fanatics', 4, 0, 'LEC', true),
  ('Ferrari Fanatics', 4, 1, 'HAM', false),
  ('Ferrari Fanatics', 4, 2, 'VER', false),
  ('Ferrari Fanatics', 4, 3, 'HAD', false),
  ('Ferrari Fanatics', 4, 4, 'ANT', false),
  ('Ferrari Fanatics', 5, 0, 'LEC', true),
  ('Ferrari Fanatics', 5, 1, 'HAM', false),
  ('Ferrari Fanatics', 5, 2, 'VER', false),
  ('Ferrari Fanatics', 5, 3, 'HAD', false),
  ('Ferrari Fanatics', 5, 4, 'ANT', false),

  -- ============== Hamilton Heroes ==============
  -- Swap: R3 slot 4 OCO -> BEA. Captain rotates: R4 RUS, else HAM.
  ('Hamilton Heroes', 1, 0, 'HAM', true),
  ('Hamilton Heroes', 1, 1, 'RUS', false),
  ('Hamilton Heroes', 1, 2, 'ANT', false),
  ('Hamilton Heroes', 1, 3, 'ALB', false),
  ('Hamilton Heroes', 1, 4, 'OCO', false),
  ('Hamilton Heroes', 2, 0, 'HAM', true),
  ('Hamilton Heroes', 2, 1, 'RUS', false),
  ('Hamilton Heroes', 2, 2, 'ANT', false),
  ('Hamilton Heroes', 2, 3, 'ALB', false),
  ('Hamilton Heroes', 2, 4, 'OCO', false),
  ('Hamilton Heroes', 3, 0, 'HAM', true),
  ('Hamilton Heroes', 3, 1, 'RUS', false),
  ('Hamilton Heroes', 3, 2, 'ANT', false),
  ('Hamilton Heroes', 3, 3, 'ALB', false),
  ('Hamilton Heroes', 3, 4, 'BEA', false),
  ('Hamilton Heroes', 4, 0, 'HAM', false),
  ('Hamilton Heroes', 4, 1, 'RUS', true),
  ('Hamilton Heroes', 4, 2, 'ANT', false),
  ('Hamilton Heroes', 4, 3, 'ALB', false),
  ('Hamilton Heroes', 4, 4, 'BEA', false),
  ('Hamilton Heroes', 5, 0, 'HAM', true),
  ('Hamilton Heroes', 5, 1, 'RUS', false),
  ('Hamilton Heroes', 5, 2, 'ANT', false),
  ('Hamilton Heroes', 5, 3, 'ALB', false),
  ('Hamilton Heroes', 5, 4, 'BEA', false),

  -- ============== Silverstone Speedsters ==============
  -- No driver swaps. Captain NOR all rounds.
  ('Silverstone Speedsters', 1, 0, 'NOR', true),
  ('Silverstone Speedsters', 1, 1, 'HAM', false),
  ('Silverstone Speedsters', 1, 2, 'RUS', false),
  ('Silverstone Speedsters', 1, 3, 'ALB', false),
  ('Silverstone Speedsters', 1, 4, 'BEA', false),
  ('Silverstone Speedsters', 2, 0, 'NOR', true),
  ('Silverstone Speedsters', 2, 1, 'HAM', false),
  ('Silverstone Speedsters', 2, 2, 'RUS', false),
  ('Silverstone Speedsters', 2, 3, 'ALB', false),
  ('Silverstone Speedsters', 2, 4, 'BEA', false),
  ('Silverstone Speedsters', 3, 0, 'NOR', true),
  ('Silverstone Speedsters', 3, 1, 'HAM', false),
  ('Silverstone Speedsters', 3, 2, 'RUS', false),
  ('Silverstone Speedsters', 3, 3, 'ALB', false),
  ('Silverstone Speedsters', 3, 4, 'BEA', false),
  ('Silverstone Speedsters', 4, 0, 'NOR', true),
  ('Silverstone Speedsters', 4, 1, 'HAM', false),
  ('Silverstone Speedsters', 4, 2, 'RUS', false),
  ('Silverstone Speedsters', 4, 3, 'ALB', false),
  ('Silverstone Speedsters', 4, 4, 'BEA', false),
  ('Silverstone Speedsters', 5, 0, 'NOR', true),
  ('Silverstone Speedsters', 5, 1, 'HAM', false),
  ('Silverstone Speedsters', 5, 2, 'RUS', false),
  ('Silverstone Speedsters', 5, 3, 'ALB', false),
  ('Silverstone Speedsters', 5, 4, 'BEA', false),

  -- ============== McLaren Masters ==============
  -- Swap: R2 slot 4 COL -> BEA. Captain PIA all rounds.
  ('McLaren Masters', 1, 0, 'PIA', true),
  ('McLaren Masters', 1, 1, 'HAD', false),
  ('McLaren Masters', 1, 2, 'GAS', false),
  ('McLaren Masters', 1, 3, 'STR', false),
  ('McLaren Masters', 1, 4, 'COL', false),
  ('McLaren Masters', 2, 0, 'PIA', true),
  ('McLaren Masters', 2, 1, 'HAD', false),
  ('McLaren Masters', 2, 2, 'GAS', false),
  ('McLaren Masters', 2, 3, 'STR', false),
  ('McLaren Masters', 2, 4, 'BEA', false),
  ('McLaren Masters', 3, 0, 'PIA', true),
  ('McLaren Masters', 3, 1, 'HAD', false),
  ('McLaren Masters', 3, 2, 'GAS', false),
  ('McLaren Masters', 3, 3, 'STR', false),
  ('McLaren Masters', 3, 4, 'BEA', false),
  ('McLaren Masters', 4, 0, 'PIA', true),
  ('McLaren Masters', 4, 1, 'HAD', false),
  ('McLaren Masters', 4, 2, 'GAS', false),
  ('McLaren Masters', 4, 3, 'STR', false),
  ('McLaren Masters', 4, 4, 'BEA', false),
  ('McLaren Masters', 5, 0, 'PIA', true),
  ('McLaren Masters', 5, 1, 'HAD', false),
  ('McLaren Masters', 5, 2, 'GAS', false),
  ('McLaren Masters', 5, 3, 'STR', false),
  ('McLaren Masters', 5, 4, 'BEA', false),

  -- ============== Norris Navigators ==============
  -- Swap: R4 slot 4 HUL -> ANT. Captain rotates: R4 HAM (slot 2), else NOR.
  ('Norris Navigators', 1, 0, 'NOR', true),
  ('Norris Navigators', 1, 1, 'HAD', false),
  ('Norris Navigators', 1, 2, 'HAM', false),
  ('Norris Navigators', 1, 3, 'ALB', false),
  ('Norris Navigators', 1, 4, 'HUL', false),
  ('Norris Navigators', 2, 0, 'NOR', true),
  ('Norris Navigators', 2, 1, 'HAD', false),
  ('Norris Navigators', 2, 2, 'HAM', false),
  ('Norris Navigators', 2, 3, 'ALB', false),
  ('Norris Navigators', 2, 4, 'HUL', false),
  ('Norris Navigators', 3, 0, 'NOR', true),
  ('Norris Navigators', 3, 1, 'HAD', false),
  ('Norris Navigators', 3, 2, 'HAM', false),
  ('Norris Navigators', 3, 3, 'ALB', false),
  ('Norris Navigators', 3, 4, 'HUL', false),
  ('Norris Navigators', 4, 0, 'NOR', false),
  ('Norris Navigators', 4, 1, 'HAD', false),
  ('Norris Navigators', 4, 2, 'HAM', true),
  ('Norris Navigators', 4, 3, 'ALB', false),
  ('Norris Navigators', 4, 4, 'ANT', false),
  ('Norris Navigators', 5, 0, 'NOR', true),
  ('Norris Navigators', 5, 1, 'HAD', false),
  ('Norris Navigators', 5, 2, 'HAM', false),
  ('Norris Navigators', 5, 3, 'ALB', false),
  ('Norris Navigators', 5, 4, 'ANT', false),

  -- ============== Spa Specialists ==============
  -- No driver swaps. Captain rotates: R3 ALO, else VER.
  ('Spa Specialists', 1, 0, 'VER', true),
  ('Spa Specialists', 1, 1, 'ALO', false),
  ('Spa Specialists', 1, 2, 'ALB', false),
  ('Spa Specialists', 1, 3, 'GAS', false),
  ('Spa Specialists', 1, 4, 'BEA', false),
  ('Spa Specialists', 2, 0, 'VER', true),
  ('Spa Specialists', 2, 1, 'ALO', false),
  ('Spa Specialists', 2, 2, 'ALB', false),
  ('Spa Specialists', 2, 3, 'GAS', false),
  ('Spa Specialists', 2, 4, 'BEA', false),
  ('Spa Specialists', 3, 0, 'VER', false),
  ('Spa Specialists', 3, 1, 'ALO', true),
  ('Spa Specialists', 3, 2, 'ALB', false),
  ('Spa Specialists', 3, 3, 'GAS', false),
  ('Spa Specialists', 3, 4, 'BEA', false),
  ('Spa Specialists', 4, 0, 'VER', true),
  ('Spa Specialists', 4, 1, 'ALO', false),
  ('Spa Specialists', 4, 2, 'ALB', false),
  ('Spa Specialists', 4, 3, 'GAS', false),
  ('Spa Specialists', 4, 4, 'BEA', false),
  ('Spa Specialists', 5, 0, 'VER', true),
  ('Spa Specialists', 5, 1, 'ALO', false),
  ('Spa Specialists', 5, 2, 'ALB', false),
  ('Spa Specialists', 5, 3, 'GAS', false),
  ('Spa Specialists', 5, 4, 'BEA', false),

  -- ============== Mercedes Maniacs ==============
  -- Swap: R2 slot 4 STR -> BEA. Captain RUS all rounds.
  ('Mercedes Maniacs', 1, 0, 'RUS', true),
  ('Mercedes Maniacs', 1, 1, 'ANT', false),
  ('Mercedes Maniacs', 1, 2, 'HAM', false),
  ('Mercedes Maniacs', 1, 3, 'HAD', false),
  ('Mercedes Maniacs', 1, 4, 'STR', false),
  ('Mercedes Maniacs', 2, 0, 'RUS', true),
  ('Mercedes Maniacs', 2, 1, 'ANT', false),
  ('Mercedes Maniacs', 2, 2, 'HAM', false),
  ('Mercedes Maniacs', 2, 3, 'HAD', false),
  ('Mercedes Maniacs', 2, 4, 'BEA', false),
  ('Mercedes Maniacs', 3, 0, 'RUS', true),
  ('Mercedes Maniacs', 3, 1, 'ANT', false),
  ('Mercedes Maniacs', 3, 2, 'HAM', false),
  ('Mercedes Maniacs', 3, 3, 'HAD', false),
  ('Mercedes Maniacs', 3, 4, 'BEA', false),
  ('Mercedes Maniacs', 4, 0, 'RUS', true),
  ('Mercedes Maniacs', 4, 1, 'ANT', false),
  ('Mercedes Maniacs', 4, 2, 'HAM', false),
  ('Mercedes Maniacs', 4, 3, 'HAD', false),
  ('Mercedes Maniacs', 4, 4, 'BEA', false),
  ('Mercedes Maniacs', 5, 0, 'RUS', true),
  ('Mercedes Maniacs', 5, 1, 'ANT', false),
  ('Mercedes Maniacs', 5, 2, 'HAM', false),
  ('Mercedes Maniacs', 5, 3, 'HAD', false),
  ('Mercedes Maniacs', 5, 4, 'BEA', false),

  -- ============== Sainz of Trouble ==============
  -- Swap: R3 slot 4 ALB -> ANT. Captain rotates: R4 LEC (slot 2), else SAI.
  ('Sainz of Trouble', 1, 0, 'SAI', true),
  ('Sainz of Trouble', 1, 1, 'VER', false),
  ('Sainz of Trouble', 1, 2, 'LEC', false),
  ('Sainz of Trouble', 1, 3, 'HAD', false),
  ('Sainz of Trouble', 1, 4, 'ALB', false),
  ('Sainz of Trouble', 2, 0, 'SAI', true),
  ('Sainz of Trouble', 2, 1, 'VER', false),
  ('Sainz of Trouble', 2, 2, 'LEC', false),
  ('Sainz of Trouble', 2, 3, 'HAD', false),
  ('Sainz of Trouble', 2, 4, 'ALB', false),
  ('Sainz of Trouble', 3, 0, 'SAI', true),
  ('Sainz of Trouble', 3, 1, 'VER', false),
  ('Sainz of Trouble', 3, 2, 'LEC', false),
  ('Sainz of Trouble', 3, 3, 'HAD', false),
  ('Sainz of Trouble', 3, 4, 'ANT', false),
  ('Sainz of Trouble', 4, 0, 'SAI', false),
  ('Sainz of Trouble', 4, 1, 'VER', false),
  ('Sainz of Trouble', 4, 2, 'LEC', true),
  ('Sainz of Trouble', 4, 3, 'HAD', false),
  ('Sainz of Trouble', 4, 4, 'ANT', false),
  ('Sainz of Trouble', 5, 0, 'SAI', true),
  ('Sainz of Trouble', 5, 1, 'VER', false),
  ('Sainz of Trouble', 5, 2, 'LEC', false),
  ('Sainz of Trouble', 5, 3, 'HAD', false),
  ('Sainz of Trouble', 5, 4, 'ANT', false)
) AS v(team_name, round, slot, driver_abbr, is_captain)
INNER JOIN team_lookup tl ON tl.team_name = v.team_name
INNER JOIN driver_lookup dl ON dl.abbreviation = v.driver_abbr;

-- ============================================================================
-- Step 3: TeamDrivers (current lineup = each team's round-5 driver per slot)
-- ============================================================================
INSERT INTO "TeamDrivers" ("TeamId", "DriverId", "SlotPosition", "CreatedBy", "CreatedAt", "IsDeleted")
SELECT
  dl.team_id AS "TeamId",
  dl.driver_id AS "DriverId",
  dl.slot AS "SlotPosition",
  tl.user_id AS "CreatedBy",
  NOW() AS "CreatedAt",
  false AS "IsDeleted"
FROM driver_lineups dl
INNER JOIN team_lookup tl ON tl.team_id = dl.team_id
WHERE dl.round = (SELECT MAX(round) FROM driver_lineups);

-- ============================================================================
-- Step 4: Constructor slots (stable across all 5 rounds)
-- ============================================================================
CREATE TEMP TABLE constructor_data ON COMMIT DROP AS
SELECT tl.team_id, v.slot, cl.constructor_id
FROM (VALUES
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
  ('Sainz of Trouble', 0, 'WIL'),
  ('Sainz of Trouble', 1, 'RBR')
) AS v(team_name, slot, constructor_abbr)
INNER JOIN team_lookup tl ON tl.team_name = v.team_name
INNER JOIN constructor_lookup cl ON cl.abbreviation = v.constructor_abbr;

INSERT INTO "TeamConstructors" ("TeamId", "ConstructorId", "SlotPosition", "CreatedBy", "CreatedAt", "IsDeleted")
SELECT
  cd.team_id AS "TeamId",
  cd.constructor_id AS "ConstructorId",
  cd.slot AS "SlotPosition",
  tl.user_id AS "CreatedBy",
  NOW() AS "CreatedAt",
  false AS "IsDeleted"
FROM constructor_data cd
INNER JOIN team_lookup tl ON tl.team_id = cd.team_id;

-- ============================================================================
-- Step 5: LineupEntries — drivers (per-round) and constructors (same all rounds)
-- ============================================================================
-- Driver entries (EntityType = 0): one row per (team, round, slot) from driver_lineups.
INSERT INTO "LineupEntries" ("TeamId", "RaceWeekendId", "EntityId", "EntityType", "SlotPosition", "IsCaptain", "CreatedAt")
SELECT
  dl.team_id AS "TeamId",
  rwl.race_weekend_id AS "RaceWeekendId",
  dl.driver_id AS "EntityId",
  0 AS "EntityType",
  dl.slot AS "SlotPosition",
  dl.is_captain AS "IsCaptain",
  NOW() AS "CreatedAt"
FROM driver_lineups dl
INNER JOIN race_weekend_lookup rwl ON rwl.round = dl.round;

-- Constructor entries (EntityType = 1). Constructors are never captain and don't
-- vary by round in this draft, so we expand the stable lineup across every
-- race weekend in race_weekend_lookup.
INSERT INTO "LineupEntries" ("TeamId", "RaceWeekendId", "EntityId", "EntityType", "SlotPosition", "IsCaptain", "CreatedAt")
SELECT
  cd.team_id AS "TeamId",
  rwl.race_weekend_id AS "RaceWeekendId",
  cd.constructor_id AS "EntityId",
  1 AS "EntityType",
  cd.slot AS "SlotPosition",
  false AS "IsCaptain",
  NOW() AS "CreatedAt"
FROM constructor_data cd
CROSS JOIN race_weekend_lookup rwl;

-- ============================================================================
-- Verification queries (uncomment to inspect)
-- ============================================================================

-- Lineup cost check on the current lineup (round-5 effective). Should be <= 100,000,000.
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
INNER JOIN team_lookup tl ON tl.team_id = t."Id"
ORDER BY t."Name";

-- LineupEntry counts per team (each team should have 7 entries x 5 races = 35,
-- with exactly 5 captain entries — one per round).
SELECT
  t."Name",
  COUNT(*) FILTER (WHERE le."EntityType" = 0) AS driver_entries,
  COUNT(*) FILTER (WHERE le."EntityType" = 1) AS constructor_entries,
  COUNT(*) FILTER (WHERE le."IsCaptain") AS captain_entries
FROM "Teams" t
INNER JOIN team_lookup tl ON tl.team_id = t."Id"
INNER JOIN "LineupEntries" le ON le."TeamId" = t."Id"
INNER JOIN race_weekend_lookup rwl ON rwl.race_weekend_id = le."RaceWeekendId"
GROUP BY t."Name"
ORDER BY t."Name";

-- ============================================================================
-- Commit (change to COMMIT to persist; ROLLBACK is the safe default)
-- ============================================================================
ROLLBACK;
-- COMMIT;
