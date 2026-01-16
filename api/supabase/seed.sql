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
  ("Name", "FullName", "CountryAbbreviation", "IsActive", "IsDeleted", "CreatedAt", "UpdatedAt", "DeletedAt")
VALUES
  ('Red Bull Racing', 'Oracle Red Bull Racing', 'AUT', true, false, NOW(), NOW(), NULL),
  ('Mercedes', 'Mercedes-AMG Petronas F1 Team', 'GER', true, false, NOW(), NOW(), NULL),
  ('Ferrari', 'Scuderia Ferrari HP', 'ITA', true, false, NOW(), NOW(), NULL),
  ('McLaren', 'McLaren F1 Team', 'GBR', true, false, NOW(), NOW(), NULL),
  ('Aston Martin', 'Aston Martin Aramco F1 Team', 'GBR', true, false, NOW(), NOW(), NULL),
  ('Alpine', 'BWT Alpine F1 Team', 'FRA', true, false, NOW(), NOW(), NULL),
  ('Williams', 'Williams Racing', 'GBR', true, false, NOW(), NOW(), NULL),
  ('Racing Bulls', 'Visa Cash App RB F1 Team', 'ITA', true, false, NOW(), NOW(), NULL),
  ('Kick Sauber', 'Stake F1 Team Kick Sauber', 'SUI', true, false, NOW(), NOW(), NULL),
  ('Haas', 'MoneyGram Haas F1 Team', 'USA', true, false, NOW(), NOW(), NULL)
ON CONFLICT DO NOTHING;
