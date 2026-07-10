-- =============================================================================
-- seed_demo_league.sql
--
-- One-shot demo seed for prod. Creates a public league with 14 teams:
--   - 4 real teams (TeamIds 1, 4, 6, 7) that already exist
--   - 10 fake teams with synthetic Supabase auth users
--
-- Also seeds:
--   - TeamDrivers + TeamConstructors for all 14 teams (each lineup <= $100M)
--   - LineupEntries for all 14 teams across rounds 1..4
--     (the rounds completed as of 2026-05-07)
--
-- After running, run from api/scripts/:
--   python3 ingest_results.py --round 1 --env prod
--   python3 ingest_results.py --round 2 --env prod
--   python3 ingest_results.py --round 3 --env prod
--   python3 ingest_results.py --round 4 --env prod
-- to load real F1 results and compute scores + standings.
--
-- IDEMPOTENT: safe to re-run. Uses ON CONFLICT DO NOTHING throughout.
-- Never deletes existing data. To regenerate lineups, delete the affected
-- TeamDriver / TeamConstructor / LineupEntry rows first.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- League config: edit these two values to rename the league.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _config ON COMMIT DROP AS
SELECT
  'Steward''s Discretion'::text AS league_name,
  'A fantasy league that should probably be under investigation.'::text AS league_description;

-- -----------------------------------------------------------------------------
-- Sanity: real teams 1, 4, 6, 7 must exist.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Teams" WHERE "Id" IN (1, 4, 6, 7)) <> 4 THEN
    RAISE EXCEPTION 'Expected real teams with Ids 1, 4, 6, 7; aborting.';
  END IF;
END $$;

-- =============================================================================
-- Stage 1: 10 fake Supabase auth users.
-- The handle_new_user() trigger creates Accounts + UserProfiles automatically.
-- DisplayName comes from raw_user_meta_data->>'displayName'.
-- =============================================================================
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous
)
VALUES
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0001-4aaa-8aaa-000000000001'::uuid,
   'authenticated', 'authenticated', 'demo01@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Alex Rivera","firstName":"Alex","lastName":"Rivera"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0002-4aaa-8aaa-000000000002'::uuid,
   'authenticated', 'authenticated', 'demo02@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Priya Patel","firstName":"Priya","lastName":"Patel"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0003-4aaa-8aaa-000000000003'::uuid,
   'authenticated', 'authenticated', 'demo03@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Marcus Chen","firstName":"Marcus","lastName":"Chen"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0004-4aaa-8aaa-000000000004'::uuid,
   'authenticated', 'authenticated', 'demo04@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Sofia Hernandez","firstName":"Sofia","lastName":"Hernandez"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0005-4aaa-8aaa-000000000005'::uuid,
   'authenticated', 'authenticated', 'demo05@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Liam O''Brien","firstName":"Liam","lastName":"O''Brien"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0006-4aaa-8aaa-000000000006'::uuid,
   'authenticated', 'authenticated', 'demo06@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Hannah Schmidt","firstName":"Hannah","lastName":"Schmidt"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0007-4aaa-8aaa-000000000007'::uuid,
   'authenticated', 'authenticated', 'demo07@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Diego Costa","firstName":"Diego","lastName":"Costa"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0008-4aaa-8aaa-000000000008'::uuid,
   'authenticated', 'authenticated', 'demo08@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Mei Tanaka","firstName":"Mei","lastName":"Tanaka"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0009-4aaa-8aaa-000000000009'::uuid,
   'authenticated', 'authenticated', 'demo09@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Jordan Bailey","firstName":"Jordan","lastName":"Bailey"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0010-4aaa-8aaa-000000000010'::uuid,
   'authenticated', 'authenticated', 'demo10@f1fantasy.local', 'demo-no-login',
   NOW(), NOW(), NOW(),
   '{"provider":"email"}'::jsonb, '{"displayName":"Noah Kowalski","firstName":"Noah","lastName":"Kowalski"}'::jsonb, false, false)
ON CONFLICT DO NOTHING;

-- Sync DisplayName / FirstName / LastName onto UserProfiles for the demo accounts.
-- (Trigger only writes DisplayName on initial INSERT; this also handles re-runs
-- where you've changed names in this script after the auth.users rows already exist.)
UPDATE "UserProfiles" up
SET "DisplayName" = src.display_name,
    "FirstName"   = src.first_name,
    "LastName"    = src.last_name,
    "UpdatedAt"   = NOW() AT TIME ZONE 'UTC'
FROM (VALUES
  ('demo01@f1fantasy.local', 'Alex Rivera',     'Alex',    'Rivera'),
  ('demo02@f1fantasy.local', 'Priya Patel',     'Priya',   'Patel'),
  ('demo03@f1fantasy.local', 'Marcus Chen',     'Marcus',  'Chen'),
  ('demo04@f1fantasy.local', 'Sofia Hernandez', 'Sofia',   'Hernandez'),
  ('demo05@f1fantasy.local', 'Liam O''Brien',   'Liam',    'O''Brien'),
  ('demo06@f1fantasy.local', 'Hannah Schmidt',  'Hannah',  'Schmidt'),
  ('demo07@f1fantasy.local', 'Diego Costa',     'Diego',   'Costa'),
  ('demo08@f1fantasy.local', 'Mei Tanaka',      'Mei',     'Tanaka'),
  ('demo09@f1fantasy.local', 'Jordan Bailey',   'Jordan',  'Bailey'),
  ('demo10@f1fantasy.local', 'Noah Kowalski',   'Noah',    'Kowalski')
) AS src(email, display_name, first_name, last_name)
WHERE up."Email" = src.email;

-- =============================================================================
-- Stage 2: Create one Team per fake user (real teams 1/4/6/7 already exist).
-- Lookup UserProfile by email; skip if a team already exists for that user.
-- =============================================================================
WITH fake_users AS (
  SELECT email, team_name FROM (VALUES
    ('demo01@f1fantasy.local', 'Backmarker Bandits'),
    ('demo02@f1fantasy.local', 'Pit Wall Prophets'),
    ('demo03@f1fantasy.local', 'Apex Anonymous'),
    ('demo04@f1fantasy.local', 'DRS Dynasty'),
    ('demo05@f1fantasy.local', 'Chequered Chaos'),
    ('demo06@f1fantasy.local', 'Slipstream Society'),
    ('demo07@f1fantasy.local', 'Pole Position Pals'),
    ('demo08@f1fantasy.local', 'Tyre Wall Wreckers'),
    ('demo09@f1fantasy.local', 'Box Box Bunch'),
    ('demo10@f1fantasy.local', 'Podium Pirates')
  ) AS t(email, team_name)
)
INSERT INTO "Teams" ("Name", "UserId", "CreatedBy", "CreatedAt", "IsDeleted")
SELECT fu.team_name, up."Id", up."Id", NOW() AT TIME ZONE 'UTC', false
FROM fake_users fu
JOIN "UserProfiles" up ON up."Email" = fu.email
WHERE NOT EXISTS (
  SELECT 1 FROM "Teams" WHERE "UserId" = up."Id"
);

-- =============================================================================
-- Stage 3: Create the league. Owner = UserProfile.Id 1.
-- =============================================================================
INSERT INTO "Leagues" ("Name", "Description", "MaxTeams", "IsPrivate", "OwnerId",
                       "CreatedBy", "CreatedAt", "IsDeleted")
SELECT (SELECT league_name FROM _config),
       (SELECT league_description FROM _config),
       15,
       false,
       1,
       1,
       NOW() AT TIME ZONE 'UTC',
       false
WHERE NOT EXISTS (
  SELECT 1 FROM "Leagues" WHERE "Name" = (SELECT league_name FROM _config)
);

-- =============================================================================
-- Stage 4: Add all 14 teams to the league.
-- =============================================================================
INSERT INTO "LeagueTeams" ("LeagueId", "TeamId", "JoinedAt",
                           "CreatedBy", "CreatedAt", "IsDeleted")
SELECT
  (SELECT "Id" FROM "Leagues" WHERE "Name" = (SELECT league_name FROM _config)),
  t."Id",
  NOW() AT TIME ZONE 'UTC',
  t."UserId",
  NOW() AT TIME ZONE 'UTC',
  false
FROM "Teams" t
WHERE t."Id" IN (1, 4, 6, 7)
   OR t."UserId" IN (
     SELECT "Id" FROM "UserProfiles"
     WHERE "Email" LIKE 'demo%@f1fantasy.local'
   )
ON CONFLICT ("LeagueId", "TeamId") DO NOTHING;

-- =============================================================================
-- Stage 5: TeamDrivers + TeamConstructors for all 14 teams.
--
-- Lineup table:
--   team key             drivers (slot 0..4)              constructors (slot 0..1)  captain  total
--   real:1               NOR HAM ALB HUL GAS              MCL CAD                   NOR      $95.6M
--   demo01               VER LEC ALB BEA STR              RBR AMR                   VER      $92.6M
--   demo02               PIA HAM ANT SAI GAS              MCL CAD                   PIA      $97.7M
--   real:4               LEC HAM RUS BEA STR              FER WIL                   LEC      $89.7M
--   demo03               RUS ANT HAM ALO GAS              MER AMR                   RUS      $81.7M
--   demo04               NOR PIA HAD STR GAS              WIL RBS                   NOR      $86.4M
--   real:6               VER PIA ALB GAS HAD              RBR ALP                   VER      $97.0M
--   real:7               HAM ANT RUS ALO STR              MER FER                   HAM      $94.6M
--   demo05               VER NOR ALB HAD COL              RBR CAD                   VER      $96.6M
--   demo06               PIA LEC ANT BEA GAS              AMR WIL                   PIA      $83.1M
--   demo07               LEC HAM ANT SAI LAW              FER MER                   LEC      $90.7M
--   demo08               VER RUS ALB OCO HAD              RBR HAA                   VER      $98.6M
--   demo09               RUS LEC HAM ALO LAW              MER AUD                   RUS      $87.9M
--   demo10               NOR ANT HUL OCO GAS              MCL CAD                   NOR      $93.3M
-- =============================================================================

-- A temp table mapping a team key to its actual TeamId, captain abbreviation,
-- driver slot 0..4, and constructor slot 0..1.
CREATE TEMP TABLE _lineup (
  team_key TEXT,
  team_id INT,
  d0 TEXT, d1 TEXT, d2 TEXT, d3 TEXT, d4 TEXT,
  c0 TEXT, c1 TEXT,
  captain TEXT
) ON COMMIT DROP;

INSERT INTO _lineup VALUES
  ('real:1', 1,
   'NOR', 'HAM', 'ALB', 'HUL', 'GAS', 'MCL', 'CAD', 'NOR'),
  ('demo01', NULL,
   'VER', 'LEC', 'ALB', 'BEA', 'STR', 'RBR', 'AMR', 'VER'),
  ('demo02', NULL,
   'PIA', 'HAM', 'ANT', 'SAI', 'GAS', 'MCL', 'CAD', 'PIA'),
  ('real:4', 4,
   'LEC', 'HAM', 'RUS', 'BEA', 'STR', 'FER', 'WIL', 'LEC'),
  ('demo03', NULL,
   'RUS', 'ANT', 'HAM', 'ALO', 'GAS', 'MER', 'AMR', 'RUS'),
  ('demo04', NULL,
   'NOR', 'PIA', 'HAD', 'STR', 'GAS', 'WIL', 'RBS', 'NOR'),
  ('real:6', 6,
   'VER', 'PIA', 'ALB', 'GAS', 'HAD', 'RBR', 'ALP', 'VER'),
  ('real:7', 7,
   'HAM', 'ANT', 'RUS', 'ALO', 'STR', 'MER', 'FER', 'HAM'),
  ('demo05', NULL,
   'VER', 'NOR', 'ALB', 'HAD', 'COL', 'RBR', 'CAD', 'VER'),
  ('demo06', NULL,
   'PIA', 'LEC', 'ANT', 'BEA', 'GAS', 'AMR', 'WIL', 'PIA'),
  ('demo07', NULL,
   'LEC', 'HAM', 'ANT', 'SAI', 'LAW', 'FER', 'MER', 'LEC'),
  ('demo08', NULL,
   'VER', 'RUS', 'ALB', 'OCO', 'HAD', 'RBR', 'HAA', 'VER'),
  ('demo09', NULL,
   'RUS', 'LEC', 'HAM', 'ALO', 'LAW', 'MER', 'AUD', 'RUS'),
  ('demo10', NULL,
   'NOR', 'ANT', 'HUL', 'OCO', 'GAS', 'MCL', 'CAD', 'NOR');

-- Resolve team_id for each demo row by email lookup.
UPDATE _lineup SET team_id = (
  SELECT t."Id"
  FROM "Teams" t
  JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo01@f1fantasy.local'
) WHERE team_key = 'demo01';
UPDATE _lineup SET team_id = (
  SELECT t."Id" FROM "Teams" t JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo02@f1fantasy.local'
) WHERE team_key = 'demo02';
UPDATE _lineup SET team_id = (
  SELECT t."Id" FROM "Teams" t JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo03@f1fantasy.local'
) WHERE team_key = 'demo03';
UPDATE _lineup SET team_id = (
  SELECT t."Id" FROM "Teams" t JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo04@f1fantasy.local'
) WHERE team_key = 'demo04';
UPDATE _lineup SET team_id = (
  SELECT t."Id" FROM "Teams" t JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo05@f1fantasy.local'
) WHERE team_key = 'demo05';
UPDATE _lineup SET team_id = (
  SELECT t."Id" FROM "Teams" t JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo06@f1fantasy.local'
) WHERE team_key = 'demo06';
UPDATE _lineup SET team_id = (
  SELECT t."Id" FROM "Teams" t JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo07@f1fantasy.local'
) WHERE team_key = 'demo07';
UPDATE _lineup SET team_id = (
  SELECT t."Id" FROM "Teams" t JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo08@f1fantasy.local'
) WHERE team_key = 'demo08';
UPDATE _lineup SET team_id = (
  SELECT t."Id" FROM "Teams" t JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo09@f1fantasy.local'
) WHERE team_key = 'demo09';
UPDATE _lineup SET team_id = (
  SELECT t."Id" FROM "Teams" t JOIN "UserProfiles" up ON up."Id" = t."UserId"
  WHERE up."Email" = 'demo10@f1fantasy.local'
) WHERE team_key = 'demo10';

-- Insert TeamDrivers (slot 0..4).
INSERT INTO "TeamDrivers" ("TeamId", "DriverId", "SlotPosition",
                           "CreatedBy", "CreatedAt", "IsDeleted")
SELECT l.team_id, d."Id", slot.slot_pos,
       (SELECT "UserId" FROM "Teams" WHERE "Id" = l.team_id),
       NOW() AT TIME ZONE 'UTC', false
FROM _lineup l
CROSS JOIN LATERAL (VALUES
  (0, l.d0), (1, l.d1), (2, l.d2), (3, l.d3), (4, l.d4)
) AS slot(slot_pos, abbr)
JOIN "Drivers" d ON d."Abbreviation" = slot.abbr
ON CONFLICT DO NOTHING;

-- Insert TeamConstructors (slot 0..1).
INSERT INTO "TeamConstructors" ("TeamId", "ConstructorId", "SlotPosition",
                                "CreatedBy", "CreatedAt", "IsDeleted")
SELECT l.team_id, c."Id", slot.slot_pos,
       (SELECT "UserId" FROM "Teams" WHERE "Id" = l.team_id),
       NOW() AT TIME ZONE 'UTC', false
FROM _lineup l
CROSS JOIN LATERAL (VALUES
  (0, l.c0), (1, l.c1)
) AS slot(slot_pos, abbr)
JOIN "Constructors" c ON c."Abbreviation" = slot.abbr
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Stage 6: LineupEntries for all 14 teams across rounds 1..4.
-- Every round gets the same lineup.
-- =============================================================================
INSERT INTO "LineupEntries" ("TeamId", "RaceWeekendId", "EntityId", "EntityType",
                             "SlotPosition", "IsCaptain", "CreatedAt")
SELECT
  l.team_id,
  rw."Id",
  d."Id",
  0,                            -- LineupEntityType.Driver
  slot.slot_pos,
  (slot.abbr = l.captain),      -- one captain per team per race
  NOW() AT TIME ZONE 'UTC'
FROM _lineup l
CROSS JOIN LATERAL (VALUES
  (0, l.d0), (1, l.d1), (2, l.d2), (3, l.d3), (4, l.d4)
) AS slot(slot_pos, abbr)
JOIN "Drivers" d ON d."Abbreviation" = slot.abbr
JOIN "RaceWeekends" rw ON rw."Round" IN (1, 2, 3, 4)
                      AND rw."SeasonId" = (SELECT "Id" FROM "Seasons" WHERE "Year" = 2026)
ON CONFLICT DO NOTHING;

INSERT INTO "LineupEntries" ("TeamId", "RaceWeekendId", "EntityId", "EntityType",
                             "SlotPosition", "IsCaptain", "CreatedAt")
SELECT
  l.team_id,
  rw."Id",
  c."Id",
  1,                            -- LineupEntityType.Constructor
  slot.slot_pos,
  false,                        -- captains are drivers only
  NOW() AT TIME ZONE 'UTC'
FROM _lineup l
CROSS JOIN LATERAL (VALUES
  (0, l.c0), (1, l.c1)
) AS slot(slot_pos, abbr)
JOIN "Constructors" c ON c."Abbreviation" = slot.abbr
JOIN "RaceWeekends" rw ON rw."Round" IN (1, 2, 3, 4)
                      AND rw."SeasonId" = (SELECT "Id" FROM "Seasons" WHERE "Year" = 2026)
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- Verification (run separately if you want a sanity check):
--   SELECT "Name", (SELECT COUNT(*) FROM "LeagueTeams" WHERE "LeagueId" = l."Id") AS teams
--   FROM "Leagues" l WHERE l."Name" = 'Steward''s Discretion';   -- replace with whatever you set in _config
--   -- expect: 14 teams
--
--   SELECT t."Id", t."Name", COUNT(*) AS lineup_rows
--   FROM "Teams" t
--   JOIN "LineupEntries" le ON le."TeamId" = t."Id"
--   WHERE le."RaceWeekendId" IN (
--     SELECT "Id" FROM "RaceWeekends"
--     WHERE "Round" IN (1,2,3,4)
--       AND "SeasonId" = (SELECT "Id" FROM "Seasons" WHERE "Year" = 2026)
--   )
--   GROUP BY t."Id", t."Name";
--   -- expect: 28 rows per team (7 entries x 4 races)
-- =============================================================================
