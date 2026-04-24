import type { PoolClient } from 'pg';

import { withE2eDb } from './db';

export interface SeededSeason {
  id: number;
  year: number;
  startDate: Date;
  endDate: Date;
}

export interface SeededDriver {
  id: number;
  firstName: string;
  lastName: string;
  abbreviation: string;
  price: number;
}

export interface SeededConstructor {
  id: number;
  name: string;
  abbreviation: string;
  price: number;
}

export interface SeededGrid {
  drivers: SeededDriver[];
  constructors: SeededConstructor[];
}

export interface SeededRaceWeekend {
  id: number;
  seasonId: number;
  round: number;
  name: string;
  circuitId: number;
  raceDate: Date;
  lockDeadline: Date | null;
}

const DEFAULT_DRIVER_PRICE = 1_000_000;
const DEFAULT_CONSTRUCTOR_PRICE = 1_000_000;

interface DriverSpec {
  firstName: string;
  lastName: string;
  abbreviation: string;
  constructorIndex: number;
}

interface ConstructorSpec {
  name: string;
  fullName: string;
  abbreviation: string;
}

// 4 constructors × 2 drivers = 8 drivers. Enough to build a 5D/2C team and
// keep swap candidates in the pickers.
const DEFAULT_CONSTRUCTORS: readonly ConstructorSpec[] = [
  { name: 'Testari', fullName: 'Testari F1 Team', abbreviation: 'TST' },
  { name: 'Mockaren', fullName: 'Mockaren F1 Team', abbreviation: 'MKR' },
  { name: 'Fixtura', fullName: 'Fixtura F1 Team', abbreviation: 'FXT' },
  { name: 'Stubson', fullName: 'Stubson F1 Team', abbreviation: 'STB' },
] as const;

const DEFAULT_DRIVERS: readonly DriverSpec[] = [
  { firstName: 'Alex', lastName: 'Alpha', abbreviation: 'ALP', constructorIndex: 0 },
  { firstName: 'Bruno', lastName: 'Bravo', abbreviation: 'BRV', constructorIndex: 0 },
  { firstName: 'Carlo', lastName: 'Charlie', abbreviation: 'CHR', constructorIndex: 1 },
  { firstName: 'Dante', lastName: 'Delta', abbreviation: 'DLT', constructorIndex: 1 },
  { firstName: 'Enzo', lastName: 'Echo', abbreviation: 'ECH', constructorIndex: 2 },
  { firstName: 'Fabio', lastName: 'Foxtrot', abbreviation: 'FXT', constructorIndex: 2 },
  { firstName: 'Gino', lastName: 'Golf', abbreviation: 'GLF', constructorIndex: 3 },
  { firstName: 'Hugo', lastName: 'Hotel', abbreviation: 'HTL', constructorIndex: 3 },
] as const;

export interface SeedCurrentSeasonOptions {
  year?: number;
}

export async function seedCurrentSeason(
  options: SeedCurrentSeasonOptions = {},
): Promise<SeededSeason> {
  const now = new Date();
  const year = options.year ?? now.getUTCFullYear();
  const startDate = new Date(now.getTime() - 30 * 86_400_000);
  const endDate = new Date(now.getTime() + 300 * 86_400_000);

  return withE2eDb(async (client) => {
    const { rows } = await client.query<{ Id: number }>(
      `INSERT INTO "Seasons" ("Year", "StartDate", "EndDate", "CreatedAt", "UpdatedAt", "IsDeleted")
       VALUES ($1, $2, $3, NOW(), NOW(), false)
       RETURNING "Id"`,
      [year, startDate, endDate],
    );
    return {
      id: rows[0]!.Id,
      year,
      startDate,
      endDate,
    };
  });
}

export interface SeedMinimalGridOptions {
  seasonId: number;
}

export async function seedMinimalGrid(options: SeedMinimalGridOptions): Promise<SeededGrid> {
  const { seasonId } = options;

  return withE2eDb(async (client) => {
    const constructors: SeededConstructor[] = [];
    for (const spec of DEFAULT_CONSTRUCTORS) {
      const constructor = await insertConstructor(client, spec);
      await linkSeasonConstructor(client, seasonId, constructor.id);
      constructors.push(constructor);
    }

    const drivers: SeededDriver[] = [];
    for (const spec of DEFAULT_DRIVERS) {
      const constructorId = constructors[spec.constructorIndex]!.id;
      const driver = await insertDriver(client, spec);
      await linkSeasonDriver(client, seasonId, driver.id, constructorId);
      drivers.push(driver);
    }

    return { drivers, constructors };
  });
}

export interface SeedRaceWeekendOptions {
  seasonId: number;
  raceDate: Date;
  lockDeadline?: Date | null;
  round?: number;
  name?: string;
  circuitName?: string;
}

export async function seedRaceWeekend(options: SeedRaceWeekendOptions): Promise<SeededRaceWeekend> {
  const round = options.round ?? 1;
  const name = options.name ?? `Round ${round} Grand Prix`;
  const circuitName = options.circuitName ?? `${name} Circuit`;
  const lockDeadline = options.lockDeadline ?? null;

  return withE2eDb(async (client) => {
    const circuitId = await insertCircuit(client, circuitName);
    const { rows } = await client.query<{ Id: number }>(
      `INSERT INTO "RaceWeekends"
         ("SeasonId", "Round", "Name", "CircuitId", "RaceDate", "LockDeadline",
          "WeekendFormat", "CreatedAt", "UpdatedAt", "IsDeleted")
       VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW(), false)
       RETURNING "Id"`,
      [options.seasonId, round, name, circuitId, options.raceDate, lockDeadline],
    );
    return {
      id: rows[0]!.Id,
      seasonId: options.seasonId,
      round,
      name,
      circuitId,
      raceDate: options.raceDate,
      lockDeadline,
    };
  });
}

async function insertConstructor(
  client: PoolClient,
  spec: ConstructorSpec,
): Promise<SeededConstructor> {
  const { rows } = await client.query<{ Id: number }>(
    `INSERT INTO "Constructors"
       ("Name", "FullName", "Abbreviation", "CountryAbbreviation", "Price",
        "CreatedAt", "UpdatedAt", "IsDeleted")
     VALUES ($1, $2, $3, 'AT', $4, NOW(), NOW(), false)
     RETURNING "Id"`,
    [spec.name, spec.fullName, spec.abbreviation, DEFAULT_CONSTRUCTOR_PRICE],
  );
  return {
    id: rows[0]!.Id,
    name: spec.name,
    abbreviation: spec.abbreviation,
    price: DEFAULT_CONSTRUCTOR_PRICE,
  };
}

async function insertDriver(client: PoolClient, spec: DriverSpec): Promise<SeededDriver> {
  const { rows } = await client.query<{ Id: number }>(
    `INSERT INTO "Drivers"
       ("FirstName", "LastName", "Abbreviation", "CountryAbbreviation", "Price",
        "CreatedAt", "UpdatedAt", "IsDeleted")
     VALUES ($1, $2, $3, 'NL', $4, NOW(), NOW(), false)
     RETURNING "Id"`,
    [spec.firstName, spec.lastName, spec.abbreviation, DEFAULT_DRIVER_PRICE],
  );
  return {
    id: rows[0]!.Id,
    firstName: spec.firstName,
    lastName: spec.lastName,
    abbreviation: spec.abbreviation,
    price: DEFAULT_DRIVER_PRICE,
  };
}

async function linkSeasonDriver(
  client: PoolClient,
  seasonId: number,
  driverId: number,
  constructorId: number,
): Promise<void> {
  await client.query(
    `INSERT INTO "SeasonDrivers"
       ("SeasonId", "DriverId", "ConstructorId", "IsActive",
        "CreatedAt", "UpdatedAt", "IsDeleted")
     VALUES ($1, $2, $3, true, NOW(), NOW(), false)`,
    [seasonId, driverId, constructorId],
  );
}

async function linkSeasonConstructor(
  client: PoolClient,
  seasonId: number,
  constructorId: number,
): Promise<void> {
  await client.query(
    `INSERT INTO "SeasonConstructors"
       ("SeasonId", "ConstructorId", "IsActive",
        "CreatedAt", "UpdatedAt", "IsDeleted")
     VALUES ($1, $2, true, NOW(), NOW(), false)`,
    [seasonId, constructorId],
  );
}

async function insertCircuit(client: PoolClient, name: string): Promise<number> {
  const { rows } = await client.query<{ Id: number }>(
    `INSERT INTO "Circuits"
       ("Name", "Location", "Country", "CreatedAt", "UpdatedAt", "IsDeleted")
     VALUES ($1, 'Test', 'Test Country', NOW(), NOW(), false)
     RETURNING "Id"`,
    [name],
  );
  return rows[0]!.Id;
}
