import { expect, test } from '@playwright/test';
import { reseedTestUserProfiles } from '../fixtures/auth';
import { withE2eDb } from '../fixtures/db';
import { resetDb } from '../fixtures/reset';
import { seedCurrentSeason, seedMinimalGrid, seedRaceWeekend } from '../fixtures/seed';
import { seedTeamForUser } from '../fixtures/team';
import { seedLeague } from '../fixtures/league';

test.describe('fixtures', () => {
  test.beforeEach(async () => {
    await resetDb();
    await reseedTestUserProfiles();
  });

  test('seedCurrentSeason inserts a season spanning now', async () => {
    const season = await seedCurrentSeason();

    expect(season.id).toBeGreaterThan(0);
    expect(season.year).toBeGreaterThan(0);
    expect(season.startDate.getTime()).toBeLessThan(Date.now());
    expect(season.endDate.getTime()).toBeGreaterThan(Date.now());

    await withE2eDb(async (client) => {
      const { rows } = await client.query<{ Year: number }>(
        `SELECT "Year" FROM "Seasons" WHERE "Id" = $1`,
        [season.id],
      );
      expect(rows[0]?.Year).toBe(season.year);
    });
  });

  test('seedMinimalGrid inserts drivers, constructors, and season links', async () => {
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });

    expect(grid.drivers.length).toBeGreaterThan(5);
    expect(grid.constructors.length).toBeGreaterThan(2);
    for (const d of grid.drivers) expect(d.id).toBeGreaterThan(0);
    for (const c of grid.constructors) expect(c.id).toBeGreaterThan(0);

    await withE2eDb(async (client) => {
      const drivers = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "SeasonDrivers"
          WHERE "SeasonId" = $1 AND "IsActive" = true`,
        [season.id],
      );
      expect(Number(drivers.rows[0]?.count)).toBe(grid.drivers.length);

      const constructors = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "SeasonConstructors"
          WHERE "SeasonId" = $1 AND "IsActive" = true`,
        [season.id],
      );
      expect(Number(constructors.rows[0]?.count)).toBe(grid.constructors.length);
    });
  });

  test('seedRaceWeekend honors supplied race date and lock deadline', async () => {
    const season = await seedCurrentSeason();
    const raceDate = new Date(Date.now() + 7 * 86_400_000);
    const lockDeadline = new Date(Date.now() - 1 * 86_400_000);

    const race = await seedRaceWeekend({
      seasonId: season.id,
      raceDate,
      lockDeadline,
      round: 2,
      name: 'Locked GP',
    });

    expect(race.id).toBeGreaterThan(0);
    expect(race.round).toBe(2);
    expect(race.name).toBe('Locked GP');

    await withE2eDb(async (client) => {
      const { rows } = await client.query<{
        RaceDate: Date;
        LockDeadline: Date | null;
      }>(`SELECT "RaceDate", "LockDeadline" FROM "RaceWeekends" WHERE "Id" = $1`, [race.id]);
      expect(rows[0]?.RaceDate.getTime()).toBe(raceDate.getTime());
      expect(rows[0]?.LockDeadline?.getTime()).toBe(lockDeadline.getTime());
    });
  });

  test('seedTeamForUser creates a team and fills roster slots via the API', async () => {
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    // Captain selection targets the upcoming race, so we need one.
    await seedRaceWeekend({
      seasonId: season.id,
      raceDate: new Date(Date.now() + 7 * 86_400_000),
      lockDeadline: new Date(Date.now() + 6 * 86_400_000),
    });

    const team = await seedTeamForUser('userA', {
      name: 'Alpha Squad',
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
      captainDriverId: grid.drivers[0]!.id,
    });

    expect(team.id).toBeGreaterThan(0);
    expect(team.name).toBe('Alpha Squad');

    await withE2eDb(async (client) => {
      const drivers = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "TeamDrivers" WHERE "TeamId" = $1`,
        [team.id],
      );
      expect(Number(drivers.rows[0]?.count)).toBe(5);

      const constructors = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "TeamConstructors" WHERE "TeamId" = $1`,
        [team.id],
      );
      expect(Number(constructors.rows[0]?.count)).toBe(2);
    });
  });

  test('seedLeague creates a league owned by the given user', async () => {
    // League creation requires the owner to already have a team.
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    await seedTeamForUser('userA', {
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });

    const league = await seedLeague('userA', { name: 'Alpha Cup', isPrivate: true });

    expect(league.id).toBeGreaterThan(0);
    expect(league.name).toBe('Alpha Cup');
    expect(league.isPrivate).toBe(true);

    await withE2eDb(async (client) => {
      const { rows } = await client.query<{ Name: string; IsPrivate: boolean }>(
        `SELECT "Name", "IsPrivate" FROM "Leagues" WHERE "Id" = $1`,
        [league.id],
      );
      expect(rows[0]?.Name).toBe('Alpha Cup');
      expect(rows[0]?.IsPrivate).toBe(true);
    });
  });
});
