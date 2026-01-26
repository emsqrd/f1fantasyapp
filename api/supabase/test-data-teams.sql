-- ============================================================================
-- Test Data Generation for Teams in League 5
-- ============================================================================
-- This script creates 10 test teams with F1-themed names and adds them to league ID 5.
-- It creates all necessary dependencies: Accounts -> UserProfiles -> Teams -> LeagueTeams
--
-- Usage: Execute this script in your Supabase SQL editor or via psql
-- Note: Account IDs are random UUIDs and cannot be used for authentication
--
-- Transaction Support:
-- - Change COMMIT to ROLLBACK at the end to test without making permanent changes
-- ============================================================================

BEGIN;

-- ============================================================================
-- Clean up existing test data (allows re-running this script)
-- ============================================================================
-- Delete in correct order to respect foreign key constraints
DELETE FROM "LeagueTeams" 
WHERE "TeamId" IN (
  SELECT "Id" FROM "Teams" 
  WHERE "UserId" IN (
    SELECT "Id" FROM "UserProfiles" 
    WHERE "Email" LIKE '%testteam%@f1fantasy.test'
  )
);

DELETE FROM "Teams" 
WHERE "UserId" IN (
  SELECT "Id" FROM "UserProfiles" 
  WHERE "Email" LIKE '%testteam%@f1fantasy.test'
);

DELETE FROM "UserProfiles" 
WHERE "Email" LIKE '%testteam%@f1fantasy.test';

DELETE FROM "Accounts" 
WHERE "Id" IN (
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0001-000000000004',
  '00000000-0000-0000-0001-000000000005',
  '00000000-0000-0000-0001-000000000006',
  '00000000-0000-0000-0001-000000000007',
  '00000000-0000-0000-0001-000000000008',
  '00000000-0000-0000-0001-000000000009',
  '00000000-0000-0000-0001-00000000000a'
);

-- ============================================================================
-- Step 1: Create Test Accounts
-- ============================================================================
INSERT INTO "Accounts" ("Id", "CreatedAt", "UpdatedAt", "DeletedAt", "IsDeleted", "IsActive", "LastLoginAt")
VALUES
  ('00000000-0000-0000-0001-000000000001', NOW(), NOW(), NULL, false, true, NULL),
  ('00000000-0000-0000-0001-000000000002', NOW(), NOW(), NULL, false, true, NULL),
  ('00000000-0000-0000-0001-000000000003', NOW(), NOW(), NULL, false, true, NULL),
  ('00000000-0000-0000-0001-000000000004', NOW(), NOW(), NULL, false, true, NULL),
  ('00000000-0000-0000-0001-000000000005', NOW(), NOW(), NULL, false, true, NULL),
  ('00000000-0000-0000-0001-000000000006', NOW(), NOW(), NULL, false, true, NULL),
  ('00000000-0000-0000-0001-000000000007', NOW(), NOW(), NULL, false, true, NULL),
  ('00000000-0000-0000-0001-000000000008', NOW(), NOW(), NULL, false, true, NULL),
  ('00000000-0000-0000-0001-000000000009', NOW(), NOW(), NULL, false, true, NULL),
  ('00000000-0000-0000-0001-00000000000a', NOW(), NOW(), NULL, false, true, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 2: Create Test User Profiles
-- ============================================================================
INSERT INTO "UserProfiles" ("AccountId", "Email", "DisplayName", "FirstName", "LastName", "AvatarUrl", "CreatedAt", "UpdatedAt")
VALUES
  ('00000000-0000-0000-0001-000000000001', 'testteam01@f1fantasy.test', 'Max Power', 'Max', 'Power', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000002', 'testteam02@f1fantasy.test', 'Speed Racer', 'Speed', 'Racer', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000003', 'testteam03@f1fantasy.test', 'Turbo Tim', 'Tim', 'Turner', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000004', 'testteam04@f1fantasy.test', 'Apex Hunter', 'Alex', 'Hunt', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000005', 'testteam05@f1fantasy.test', 'Grid Master', 'Greg', 'Masters', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000006', 'testteam06@f1fantasy.test', 'Pole Position Pete', 'Pete', 'Polson', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000007', 'testteam07@f1fantasy.test', 'DRS Danny', 'Danny', 'Richardson', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000008', 'testteam08@f1fantasy.test', 'Slipstream Sam', 'Sam', 'Stevens', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000009', 'testteam09@f1fantasy.test', 'Pit Stop Pro', 'Paul', 'Stone', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0001-00000000000a', 'testteam10@f1fantasy.test', 'Chicane Charlie', 'Charlie', 'Chen', NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 3: Create Test Teams with F1-Themed Names
-- ============================================================================
-- Get the UserProfile IDs and create teams
-- Mix of team-based, driver-based, and circuit-based names
WITH user_ids AS (
  SELECT "Id", ROW_NUMBER() OVER (ORDER BY "Id") as rn
  FROM "UserProfiles"
  WHERE "Email" LIKE '%testteam%@f1fantasy.test'
  ORDER BY "Id"
  LIMIT 10
)
INSERT INTO "Teams" ("Name", "UserId", "CreatedBy", "CreatedAt", "UpdatedAt", "DeletedAt", "IsDeleted", "UpdatedBy", "DeletedBy")
SELECT
  CASE rn
    WHEN 1 THEN 'Red Bull Rivals'           -- F1 team-based
    WHEN 2 THEN 'Verstappen''s Victory'     -- Driver-based
    WHEN 3 THEN 'Monza Mavericks'           -- Circuit-based
    WHEN 4 THEN 'Ferrari Fanatics'          -- F1 team-based
    WHEN 5 THEN 'Hamilton Heroes'           -- Driver-based
    WHEN 6 THEN 'Silverstone Speedsters'    -- Circuit-based
    WHEN 7 THEN 'McLaren Masters'           -- F1 team-based
    WHEN 8 THEN 'Norris Navigators'         -- Driver-based
    WHEN 9 THEN 'Spa Specialists'           -- Circuit-based
    WHEN 10 THEN 'Mercedes Maniacs'         -- F1 team-based
  END as "Name",
  "Id" as "UserId",
  "Id" as "CreatedBy",
  NOW() as "CreatedAt",
  NOW() as "UpdatedAt",
  NULL as "DeletedAt",
  false as "IsDeleted",
  NULL as "UpdatedBy",
  NULL as "DeletedBy"
FROM user_ids
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 4: Add Teams to League 5
-- ============================================================================
-- Join all test teams to league ID 5
WITH team_ids AS (
  SELECT t."Id", up."Id" as "UserId"
  FROM "Teams" t
  INNER JOIN "UserProfiles" up ON t."UserId" = up."Id"
  WHERE up."Email" LIKE '%testteam%@f1fantasy.test'
)
INSERT INTO "LeagueTeams" ("LeagueId", "TeamId", "JoinedAt", "CreatedBy", "CreatedAt", "UpdatedAt", "DeletedAt", "IsDeleted", "UpdatedBy", "DeletedBy")
SELECT
  5 as "LeagueId",
  "Id" as "TeamId",
  NOW() as "JoinedAt",
  "UserId" as "CreatedBy",
  NOW() as "CreatedAt",
  NOW() as "UpdatedAt",
  NULL as "DeletedAt",
  false as "IsDeleted",
  NULL as "UpdatedBy",
  NULL as "DeletedBy"
FROM team_ids
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Verification Queries (optional - uncomment to run)
-- ============================================================================

-- Verify accounts were created
SELECT * FROM "Accounts" WHERE "Id" LIKE '00000000-0000-0000-0001-%' ORDER BY "Id";

-- Verify user profiles were created
SELECT * FROM "UserProfiles" WHERE "Email" LIKE '%testteam%@f1fantasy.test' ORDER BY "Email";

-- Verify teams were created
SELECT t."Id", t."Name", up."Email", up."DisplayName"
FROM "Teams" t
INNER JOIN "UserProfiles" up ON t."UserId" = up."Id"
WHERE up."Email" LIKE '%testteam%@f1fantasy.test'
ORDER BY t."Id";

-- Verify league memberships were created
SELECT lt."LeagueId", lt."TeamId", t."Name", lt."JoinedAt"
FROM "LeagueTeams" lt
INNER JOIN "Teams" t ON lt."TeamId" = t."Id"
INNER JOIN "UserProfiles" up ON t."UserId" = up."Id"
WHERE up."Email" LIKE '%testteam%@f1fantasy.test'
ORDER BY t."Name";

-- Count teams in league 5
SELECT COUNT(*) as team_count FROM "LeagueTeams" WHERE "LeagueId" = 5;

-- ============================================================================
-- Commit the transaction (change to ROLLBACK to undo all changes for testing)
-- ============================================================================
ROLLBACK;
-- COMMIT;

