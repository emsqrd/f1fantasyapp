-- Standalone price UPDATE script — run manually against any environment to set prices without a deploy.
-- Update values here as real SportsDeck 2026 prices are confirmed.

-- Driver prices
-- Known (calculated from docs/research/driver-value-research.json via round_to_100K(262,000 × previous_average)):
UPDATE "Drivers" SET "Price" = 25600000 WHERE "Abbreviation" = 'NOR';
UPDATE "Drivers" SET "Price" = 22800000 WHERE "Abbreviation" = 'LEC';
UPDATE "Drivers" SET "Price" = 18600000 WHERE "Abbreviation" = 'SAI';
UPDATE "Drivers" SET "Price" = 18500000 WHERE "Abbreviation" = 'PIA';
UPDATE "Drivers" SET "Price" = 17700000 WHERE "Abbreviation" = 'RUS';
UPDATE "Drivers" SET "Price" = 7200000  WHERE "Abbreviation" = 'ALO';
UPDATE "Drivers" SET "Price" = 5300000  WHERE "Abbreviation" = 'GAS';
-- Placeholder ($3M floor — update when SportsDeck 2026 prices are available):
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'VER';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'HAM';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'ANT';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'HAD';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'STR';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'LAW';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'ALB';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'HUL';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'BOR';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'OCO';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'BEA';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'COL';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'LIN';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'DOO';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'TSU';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'BOT';
UPDATE "Drivers" SET "Price" = 3000000  WHERE "Abbreviation" = 'PER';

-- Constructor prices
-- Known:
UPDATE "Constructors" SET "Price" = 28300000 WHERE "Abbreviation" = 'MCL';
UPDATE "Constructors" SET "Price" = 26500000 WHERE "Abbreviation" = 'FER';
UPDATE "Constructors" SET "Price" = 25200000 WHERE "Abbreviation" = 'RBR';
UPDATE "Constructors" SET "Price" = 8000000  WHERE "Abbreviation" = 'AMR';
UPDATE "Constructors" SET "Price" = 7500000  WHERE "Abbreviation" = 'ALP';
UPDATE "Constructors" SET "Price" = 4400000  WHERE "Abbreviation" = 'WIL';
-- Placeholder ($3M floor — update when SportsDeck 2026 prices are available):
UPDATE "Constructors" SET "Price" = 3000000  WHERE "Abbreviation" = 'MER';
UPDATE "Constructors" SET "Price" = 3000000  WHERE "Abbreviation" = 'RBS';
UPDATE "Constructors" SET "Price" = 3000000  WHERE "Abbreviation" = 'SAU';
UPDATE "Constructors" SET "Price" = 3000000  WHERE "Abbreviation" = 'HAA';
UPDATE "Constructors" SET "Price" = 3000000  WHERE "Abbreviation" = 'AUD';
UPDATE "Constructors" SET "Price" = 3000000  WHERE "Abbreviation" = 'CAD';
