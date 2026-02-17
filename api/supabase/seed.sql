-- Insert 2025 F1 Season Drivers
INSERT INTO "Drivers" 
  ("FirstName", "LastName", "Abbreviation", "CountryAbbreviation", "IsActive", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
VALUES
  -- Red Bull Racing
  ('Max', 'Verstappen', 'VER', 'NED', true, false, NOW(), NOW(), NULL),
  ('Liam', 'Lawson', 'LAW', 'NZL', true, false, NOW(), NOW(), NULL),
  
  -- Mercedes
  ('George', 'Russell', 'RUS', 'GBR', true, false, NOW(), NOW(), NULL),
  ('Kimi', 'Antonelli', 'ANT', 'ITA', true, false, NOW(), NOW(), NULL),
  
  -- Ferrari
  ('Charles', 'Leclerc', 'LEC', 'MON', true, false, NOW(), NOW(), NULL),
  ('Lewis', 'Hamilton', 'HAM', 'GBR', true, false, NOW(), NOW(), NULL),
  
  -- McLaren
  ('Lando', 'Norris', 'NOR', 'GBR', true, false, NOW(), NOW(), NULL),
  ('Oscar', 'Piastri', 'PIA', 'AUS', true, false, NOW(), NOW(), NULL),
  
  -- Aston Martin
  ('Fernando', 'Alonso', 'ALO', 'ESP', true, false, NOW(), NOW(), NULL),
  ('Lance', 'Stroll', 'STR', 'CAN', true, false, NOW(), NOW(), NULL),
  
  -- Alpine
  ('Pierre', 'Gasly', 'GAS', 'FRA', true, false, NOW(), NOW(), NULL),
  ('Jack', 'Doohan', 'DOO', 'AUS', true, false, NOW(), NOW(), NULL),
  
  -- Williams
  ('Alex', 'Albon', 'ALB', 'THA', true, false, NOW(), NOW(), NULL),
  ('Carlos', 'Sainz', 'SAI', 'ESP', true, false, NOW(), NOW(), NULL),
  
  -- RB (AlphaTauri)
  ('Yuki', 'Tsunoda', 'TSU', 'JPN', true, false, NOW(), NOW(), NULL),
  ('Isack', 'Hadjar', 'HAD', 'FRA', true, false, NOW(), NOW(), NULL),
  
  -- Kick Sauber
  ('Nico', 'Hulkenberg', 'HUL', 'GER', true, false, NOW(), NOW(), NULL),
  ('Gabriel', 'Bortoleto', 'BOR', 'BRA', true, false, NOW(), NOW(), NULL),
  
  -- Haas
  ('Esteban', 'Ocon', 'OCO', 'FRA', true, false, NOW(), NOW(), NULL),
  ('Oliver', 'Bearman', 'BEA', 'GBR', true, false, NOW(), NOW(), NULL)
ON CONFLICT DO NOTHING;

-- Insert 2025 F1 Season Constructors
INSERT INTO "Constructors"
  ("Name", "FullName", "Abbreviation", "CountryAbbreviation", "IsActive", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
VALUES
  ('Red Bull Racing', 'Oracle Red Bull Racing', 'RBR', 'AUT', true, false, NOW(), NOW(), NULL),
  ('Mercedes', 'Mercedes-AMG Petronas F1 Team', 'MER', 'GER', true, false, NOW(), NOW(), NULL),
  ('Ferrari', 'Scuderia Ferrari HP', 'FER', 'ITA', true, false, NOW(), NOW(), NULL),
  ('McLaren', 'McLaren F1 Team', 'MCL', 'GBR', true, false, NOW(), NOW(), NULL),
  ('Aston Martin', 'Aston Martin Aramco F1 Team', 'AMR', 'GBR', true, false, NOW(), NOW(), NULL),
  ('Alpine', 'BWT Alpine F1 Team', 'ALP', 'FRA', true, false, NOW(), NOW(), NULL),
  ('Williams', 'Williams Racing', 'WIL', 'GBR', true, false, NOW(), NOW(), NULL),
  ('Racing Bulls', 'Visa Cash App RB F1 Team', 'RBS', 'ITA', true, false, NOW(), NOW(), NULL),
  ('Kick Sauber', 'Stake F1 Team Kick Sauber', 'SAU', 'SUI', true, false, NOW(), NOW(), NULL),
  ('Haas', 'MoneyGram Haas F1 Team', 'HAA', 'USA', true, false, NOW(), NOW(), NULL)
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

-- Insert 2026 F1 Season Races
DO $$
DECLARE
  season_id INTEGER;
BEGIN
  -- Get the SeasonId for 2026
  SELECT "Id" INTO season_id FROM "Seasons" WHERE "Year" = 2026;

  -- Insert all races for 2026 season
  INSERT INTO "Races"
    ("SeasonId", "Round", "Name", "Location", "Circuit", "Country", "RaceDate", "LockDeadline", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
  VALUES
    (season_id, 1, 'Australian Grand Prix', 'Melbourne', 'Melbourne Grand Prix Circuit', 'Australia', '2026-03-08', NULL, false, NOW(), NOW(), NULL),
    (season_id, 2, 'Chinese Grand Prix', 'Shanghai', 'Shanghai International Circuit', 'China', '2026-03-15', NULL, false, NOW(), NOW(), NULL),
    (season_id, 3, 'Japanese Grand Prix', 'Suzuka', 'Suzuka Circuit', 'Japan', '2026-03-29', NULL, false, NOW(), NOW(), NULL),
    (season_id, 4, 'Bahrain Grand Prix', 'Sakhir', 'Bahrain International Circuit', 'Bahrain', '2026-04-12', NULL, false, NOW(), NOW(), NULL),
    (season_id, 5, 'Saudi Arabian Grand Prix', 'Jeddah', 'Jeddah Corniche Circuit', 'Saudi Arabia', '2026-04-19', NULL, false, NOW(), NOW(), NULL),
    (season_id, 6, 'Miami Grand Prix', 'Miami', 'Miami International Autodrome', 'United States', '2026-05-03', NULL, false, NOW(), NOW(), NULL),
    (season_id, 7, 'Canadian Grand Prix', 'Montreal', 'Circuit Gilles Villeneuve', 'Canada', '2026-05-24', NULL, false, NOW(), NOW(), NULL),
    (season_id, 8, 'Monaco Grand Prix', 'Monte Carlo', 'Circuit de Monaco', 'Monaco', '2026-06-07', NULL, false, NOW(), NOW(), NULL),
    (season_id, 9, 'Spanish Grand Prix', 'Barcelona', 'Circuit de Barcelona-Catalunya', 'Spain', '2026-06-14', NULL, false, NOW(), NOW(), NULL),
    (season_id, 10, 'Austrian Grand Prix', 'Spielberg', 'Red Bull Ring', 'Austria', '2026-06-28', NULL, false, NOW(), NOW(), NULL),
    (season_id, 11, 'British Grand Prix', 'Silverstone', 'Silverstone Circuit', 'United Kingdom', '2026-07-05', NULL, false, NOW(), NOW(), NULL),
    (season_id, 12, 'Belgian Grand Prix', 'Spa', 'Circuit de Spa-Francorchamps', 'Belgium', '2026-07-19', NULL, false, NOW(), NOW(), NULL),
    (season_id, 13, 'Hungarian Grand Prix', 'Budapest', 'Hungaroring', 'Hungary', '2026-07-26', NULL, false, NOW(), NOW(), NULL),
    (season_id, 14, 'Dutch Grand Prix', 'Zandvoort', 'Circuit Zandvoort', 'Netherlands', '2026-08-23', NULL, false, NOW(), NOW(), NULL),
    (season_id, 15, 'Italian Grand Prix', 'Monza', 'Autodromo Nazionale di Monza', 'Italy', '2026-09-06', NULL, false, NOW(), NOW(), NULL),
    (season_id, 16, 'Madrid Grand Prix', 'Madrid', 'Madrid Street Circuit', 'Spain', '2026-09-13', NULL, false, NOW(), NOW(), NULL),
    (season_id, 17, 'Azerbaijan Grand Prix', 'Baku', 'Baku City Circuit', 'Azerbaijan', '2026-09-26', NULL, false, NOW(), NOW(), NULL),
    (season_id, 18, 'Singapore Grand Prix', 'Singapore', 'Marina Bay Street Circuit', 'Singapore', '2026-10-11', NULL, false, NOW(), NOW(), NULL),
    (season_id, 19, 'United States Grand Prix', 'Austin', 'Circuit of the Americas', 'United States', '2026-10-25', NULL, false, NOW(), NOW(), NULL),
    (season_id, 20, 'Mexico City Grand Prix', 'Mexico City', 'Autódromo Hermanos Rodríguez', 'Mexico', '2026-11-01', NULL, false, NOW(), NOW(), NULL),
    (season_id, 21, 'São Paulo Grand Prix', 'São Paulo', 'Autódromo José Carlos Pace', 'Brazil', '2026-11-08', NULL, false, NOW(), NOW(), NULL),
    (season_id, 22, 'Las Vegas Grand Prix', 'Las Vegas', 'Las Vegas Street Circuit', 'United States', '2026-11-21', NULL, false, NOW(), NOW(), NULL),
    (season_id, 23, 'Qatar Grand Prix', 'Lusail', 'Lusail International Circuit', 'Qatar', '2026-11-29', NULL, false, NOW(), NOW(), NULL),
    (season_id, 24, 'Abu Dhabi Grand Prix', 'Abu Dhabi', 'Yas Marina Circuit', 'United Arab Emirates', '2026-12-06', NULL, false, NOW(), NOW(), NULL)
  ON CONFLICT ("SeasonId", "Round") DO NOTHING;
END $$;
