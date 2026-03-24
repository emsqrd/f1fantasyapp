-- Insert F1 Drivers
INSERT INTO "Drivers"
  ("FirstName", "LastName", "Abbreviation", "CountryAbbreviation", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
VALUES
  -- Red Bull Racing
  ('Max', 'Verstappen', 'VER', 'NED', false, NOW(), NOW(), NULL),
  ('Isack', 'Hadjar', 'HAD', 'FRA', false, NOW(), NOW(), NULL),

  -- Mercedes
  ('George', 'Russell', 'RUS', 'GBR', false, NOW(), NOW(), NULL),
  ('Kimi', 'Antonelli', 'ANT', 'ITA', false, NOW(), NOW(), NULL),

  -- Ferrari
  ('Charles', 'Leclerc', 'LEC', 'MON', false, NOW(), NOW(), NULL),
  ('Lewis', 'Hamilton', 'HAM', 'GBR', false, NOW(), NOW(), NULL),

  -- McLaren
  ('Lando', 'Norris', 'NOR', 'GBR', false, NOW(), NOW(), NULL),
  ('Oscar', 'Piastri', 'PIA', 'AUS', false, NOW(), NOW(), NULL),

  -- Aston Martin
  ('Fernando', 'Alonso', 'ALO', 'ESP', false, NOW(), NOW(), NULL),
  ('Lance', 'Stroll', 'STR', 'CAN', false, NOW(), NOW(), NULL),

  -- Alpine
  ('Pierre', 'Gasly', 'GAS', 'FRA', false, NOW(), NOW(), NULL),
  ('Franco', 'Colapinto', 'COL', 'ARG', false, NOW(), NOW(), NULL),

  -- Williams
  ('Alex', 'Albon', 'ALB', 'THA', false, NOW(), NOW(), NULL),
  ('Carlos', 'Sainz', 'SAI', 'ESP', false, NOW(), NOW(), NULL),

  -- Racing Bulls
  ('Liam', 'Lawson', 'LAW', 'NZL', false, NOW(), NOW(), NULL),
  ('Arvid', 'Lindblad', 'LIN', 'GBR', false, NOW(), NOW(), NULL),

  -- Audi
  ('Nico', 'Hulkenberg', 'HUL', 'GER', false, NOW(), NOW(), NULL),
  ('Gabriel', 'Bortoleto', 'BOR', 'BRA', false, NOW(), NOW(), NULL),

  -- Haas
  ('Esteban', 'Ocon', 'OCO', 'FRA', false, NOW(), NOW(), NULL),
  ('Oliver', 'Bearman', 'BEA', 'GBR', false, NOW(), NOW(), NULL),

  -- Cadillac
  ('Valtteri', 'Bottas', 'BOT', 'FIN', false, NOW(), NOW(), NULL),
  ('Sergio', 'Perez', 'PER', 'MEX', false, NOW(), NOW(), NULL),

  -- Historical drivers (no 2026 seat)
  ('Jack', 'Doohan', 'DOO', 'AUS', false, NOW(), NOW(), NULL),
  ('Yuki', 'Tsunoda', 'TSU', 'JPN', false, NOW(), NOW(), NULL)
ON CONFLICT DO NOTHING;

-- Insert F1 Constructors
INSERT INTO "Constructors"
  ("Name", "FullName", "Abbreviation", "CountryAbbreviation", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
VALUES
  ('Red Bull Racing', 'Oracle Red Bull Racing', 'RBR', 'AUT', false, NOW(), NOW(), NULL),
  ('Mercedes', 'Mercedes-AMG Petronas F1 Team', 'MER', 'GER', false, NOW(), NOW(), NULL),
  ('Ferrari', 'Scuderia Ferrari HP', 'FER', 'ITA', false, NOW(), NOW(), NULL),
  ('McLaren', 'McLaren F1 Team', 'MCL', 'GBR', false, NOW(), NOW(), NULL),
  ('Aston Martin', 'Aston Martin Aramco F1 Team', 'AMR', 'GBR', false, NOW(), NOW(), NULL),
  ('Alpine', 'BWT Alpine F1 Team', 'ALP', 'FRA', false, NOW(), NOW(), NULL),
  ('Williams', 'Williams Racing', 'WIL', 'GBR', false, NOW(), NOW(), NULL),
  ('Racing Bulls', 'Visa Cash App RB F1 Team', 'RBS', 'ITA', false, NOW(), NOW(), NULL),
  ('Kick Sauber', 'Stake F1 Team Kick Sauber', 'SAU', 'SUI', false, NOW(), NOW(), NULL),
  ('Haas', 'MoneyGram Haas F1 Team', 'HAA', 'USA', false, NOW(), NOW(), NULL),
  ('Audi', 'Audi F1 Team', 'AUD', 'GER', false, NOW(), NOW(), NULL),
  ('Cadillac', 'Cadillac F1 Team', 'CAD', 'USA', false, NOW(), NOW(), NULL)
ON CONFLICT ("Name") DO UPDATE SET
  "FullName" = EXCLUDED."FullName",
  "Abbreviation" = EXCLUDED."Abbreviation",
  "CountryAbbreviation" = EXCLUDED."CountryAbbreviation",
  "UpdatedAt" = NOW();

-- Insert 2026 F1 Season
INSERT INTO "Seasons"
  ("Year", "StartDate", "EndDate", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
VALUES
  (2026, '2026-03-08', '2026-12-06', false, NOW(), NOW(), NULL)
ON CONFLICT ("Year") DO NOTHING;

-- Insert 2026 F1 Season Races, SeasonConstructors, and SeasonDrivers
DO $$
DECLARE
  season_id INTEGER;
  -- Constructor IDs
  rbr_id INTEGER;
  mer_id INTEGER;
  fer_id INTEGER;
  mcl_id INTEGER;
  amr_id INTEGER;
  alp_id INTEGER;
  wil_id INTEGER;
  rbs_id INTEGER;
  haa_id INTEGER;
  aud_id INTEGER;
  cad_id INTEGER;
BEGIN
  -- Get the SeasonId for 2026
  SELECT "Id" INTO season_id FROM "Seasons" WHERE "Year" = 2026;

  -- Get Constructor IDs
  SELECT "Id" INTO rbr_id FROM "Constructors" WHERE "Abbreviation" = 'RBR';
  SELECT "Id" INTO mer_id FROM "Constructors" WHERE "Abbreviation" = 'MER';
  SELECT "Id" INTO fer_id FROM "Constructors" WHERE "Abbreviation" = 'FER';
  SELECT "Id" INTO mcl_id FROM "Constructors" WHERE "Abbreviation" = 'MCL';
  SELECT "Id" INTO amr_id FROM "Constructors" WHERE "Abbreviation" = 'AMR';
  SELECT "Id" INTO alp_id FROM "Constructors" WHERE "Abbreviation" = 'ALP';
  SELECT "Id" INTO wil_id FROM "Constructors" WHERE "Abbreviation" = 'WIL';
  SELECT "Id" INTO rbs_id FROM "Constructors" WHERE "Abbreviation" = 'RBS';
  SELECT "Id" INTO haa_id FROM "Constructors" WHERE "Abbreviation" = 'HAA';
  SELECT "Id" INTO aud_id FROM "Constructors" WHERE "Abbreviation" = 'AUD';
  SELECT "Id" INTO cad_id FROM "Constructors" WHERE "Abbreviation" = 'CAD';

  -- Insert SeasonConstructors for 2026 (11 teams, Kick Sauber excluded)
  INSERT INTO "SeasonConstructors"
    ("SeasonId", "ConstructorId", "IsActive", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
  VALUES
    (season_id, rbr_id, true, false, NOW(), NOW(), NULL),
    (season_id, mer_id, true, false, NOW(), NOW(), NULL),
    (season_id, fer_id, true, false, NOW(), NOW(), NULL),
    (season_id, mcl_id, true, false, NOW(), NOW(), NULL),
    (season_id, amr_id, true, false, NOW(), NOW(), NULL),
    (season_id, alp_id, true, false, NOW(), NOW(), NULL),
    (season_id, wil_id, true, false, NOW(), NOW(), NULL),
    (season_id, rbs_id, true, false, NOW(), NOW(), NULL),
    (season_id, haa_id, true, false, NOW(), NOW(), NULL),
    (season_id, aud_id, true, false, NOW(), NOW(), NULL),
    (season_id, cad_id, true, false, NOW(), NOW(), NULL)
  ON CONFLICT ("SeasonId", "ConstructorId") DO NOTHING;

  -- Insert SeasonDrivers for 2026 (22 drivers)
  INSERT INTO "SeasonDrivers"
    ("SeasonId", "DriverId", "ConstructorId", "IsActive", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
  VALUES
    -- Red Bull Racing
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'VER'), rbr_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'HAD'), rbr_id, true, false, NOW(), NOW(), NULL),
    -- Mercedes
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'RUS'), mer_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'ANT'), mer_id, true, false, NOW(), NOW(), NULL),
    -- Ferrari
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'LEC'), fer_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'HAM'), fer_id, true, false, NOW(), NOW(), NULL),
    -- McLaren
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'NOR'), mcl_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'PIA'), mcl_id, true, false, NOW(), NOW(), NULL),
    -- Aston Martin
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'ALO'), amr_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'STR'), amr_id, true, false, NOW(), NOW(), NULL),
    -- Alpine
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'GAS'), alp_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'COL'), alp_id, true, false, NOW(), NOW(), NULL),
    -- Williams
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'ALB'), wil_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'SAI'), wil_id, true, false, NOW(), NOW(), NULL),
    -- Racing Bulls
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'LAW'), rbs_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'LIN'), rbs_id, true, false, NOW(), NOW(), NULL),
    -- Audi
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'HUL'), aud_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'BOR'), aud_id, true, false, NOW(), NOW(), NULL),
    -- Haas
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'OCO'), haa_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'BEA'), haa_id, true, false, NOW(), NOW(), NULL),
    -- Cadillac
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'BOT'), cad_id, true, false, NOW(), NOW(), NULL),
    (season_id, (SELECT "Id" FROM "Drivers" WHERE "Abbreviation" = 'PER'), cad_id, true, false, NOW(), NOW(), NULL)
  ON CONFLICT ("SeasonId", "DriverId") DO NOTHING;

  -- Insert all races for 2026 season
  -- Sprint races: China, Miami, Canada, Great Britain, Netherlands, Singapore
  INSERT INTO "Races"
    ("SeasonId", "Round", "Name", "Location", "Circuit", "Country", "RaceDate", "LockDeadline", "HasSprint", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
  VALUES
    (season_id, 1, 'Australian Grand Prix', 'Melbourne', 'Melbourne Grand Prix Circuit', 'Australia', '2026-03-08 04:00:00+00', '2026-03-07 05:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 2, 'Chinese Grand Prix', 'Shanghai', 'Shanghai International Circuit', 'China', '2026-03-15 07:00:00+00', '2026-03-14 07:00:00+00', true, false, NOW(), NOW(), NULL),
    (season_id, 3, 'Japanese Grand Prix', 'Suzuka', 'Suzuka Circuit', 'Japan', '2026-03-29 05:00:00+00', '2026-03-28 06:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 4, 'Bahrain Grand Prix', 'Sakhir', 'Bahrain International Circuit', 'Bahrain', '2026-04-12 15:00:00+00', '2026-04-11 16:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 5, 'Saudi Arabian Grand Prix', 'Jeddah', 'Jeddah Corniche Circuit', 'Saudi Arabia', '2026-04-19 17:00:00+00', '2026-04-18 17:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 6, 'Miami Grand Prix', 'Miami', 'Miami International Autodrome', 'United States', '2026-05-03 20:00:00+00', '2026-05-02 20:00:00+00', true, false, NOW(), NOW(), NULL),
    (season_id, 7, 'Canadian Grand Prix', 'Montreal', 'Circuit Gilles Villeneuve', 'Canada', '2026-05-24 20:00:00+00', '2026-05-23 20:00:00+00', true, false, NOW(), NOW(), NULL),
    (season_id, 8, 'Monaco Grand Prix', 'Monte Carlo', 'Circuit de Monaco', 'Monaco', '2026-06-07 13:00:00+00', '2026-06-06 14:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 9, 'Spanish Grand Prix', 'Barcelona', 'Circuit de Barcelona-Catalunya', 'Spain', '2026-06-14 13:00:00+00', '2026-06-13 14:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 10, 'Austrian Grand Prix', 'Spielberg', 'Red Bull Ring', 'Austria', '2026-06-28 13:00:00+00', '2026-06-27 14:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 11, 'British Grand Prix', 'Silverstone', 'Silverstone Circuit', 'United Kingdom', '2026-07-05 14:00:00+00', '2026-07-04 15:00:00+00', true, false, NOW(), NOW(), NULL),
    (season_id, 12, 'Belgian Grand Prix', 'Spa', 'Circuit de Spa-Francorchamps', 'Belgium', '2026-07-19 13:00:00+00', '2026-07-18 14:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 13, 'Hungarian Grand Prix', 'Budapest', 'Hungaroring', 'Hungary', '2026-07-26 13:00:00+00', '2026-07-25 14:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 14, 'Dutch Grand Prix', 'Zandvoort', 'Circuit Zandvoort', 'Netherlands', '2026-08-23 13:00:00+00', '2026-08-22 14:00:00+00', true, false, NOW(), NOW(), NULL),
    (season_id, 15, 'Italian Grand Prix', 'Monza', 'Autodromo Nazionale di Monza', 'Italy', '2026-09-06 13:00:00+00', '2026-09-05 14:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 16, 'Madrid Grand Prix', 'Madrid', 'Madrid Street Circuit', 'Spain', '2026-09-13 13:00:00+00', '2026-09-12 14:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 17, 'Azerbaijan Grand Prix', 'Baku', 'Baku City Circuit', 'Azerbaijan', '2026-09-26 11:00:00+00', '2026-09-25 12:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 18, 'Singapore Grand Prix', 'Singapore', 'Marina Bay Street Circuit', 'Singapore', '2026-10-11 12:00:00+00', '2026-10-10 13:00:00+00', true, false, NOW(), NOW(), NULL),
    (season_id, 19, 'United States Grand Prix', 'Austin', 'Circuit of the Americas', 'United States', '2026-10-25 20:00:00+00', '2026-10-24 21:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 20, 'Mexico City Grand Prix', 'Mexico City', 'Autódromo Hermanos Rodríguez', 'Mexico', '2026-11-01 20:00:00+00', '2026-10-31 21:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 21, 'São Paulo Grand Prix', 'São Paulo', 'Autódromo José Carlos Pace', 'Brazil', '2026-11-08 17:00:00+00', '2026-11-07 18:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 22, 'Las Vegas Grand Prix', 'Las Vegas', 'Las Vegas Street Circuit', 'United States', '2026-11-22 04:00:00+00', '2026-11-21 04:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 23, 'Qatar Grand Prix', 'Lusail', 'Lusail International Circuit', 'Qatar', '2026-11-29 16:00:00+00', '2026-11-28 18:00:00+00', false, false, NOW(), NOW(), NULL),
    (season_id, 24, 'Abu Dhabi Grand Prix', 'Abu Dhabi', 'Yas Marina Circuit', 'United Arab Emirates', '2026-12-06 13:00:00+00', '2026-12-05 14:00:00+00', false, false, NOW(), NOW(), NULL)
  ON CONFLICT ("SeasonId", "Round") DO UPDATE SET
    "RaceDate" = EXCLUDED."RaceDate",
    "LockDeadline" = EXCLUDED."LockDeadline",
    "HasSprint" = EXCLUDED."HasSprint",
    "UpdatedAt" = NOW();
END $$;
