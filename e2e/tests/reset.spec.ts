import { expect, test } from '@playwright/test';
import { withE2eDb } from '../fixtures/db';
import { resetDb } from '../fixtures/reset';

test('resetDb clears all public tables except migrations history', async () => {
  await withE2eDb(async (client) => {
    await client.query(
      `INSERT INTO "Drivers" ("FirstName", "LastName", "Abbreviation",
        "CountryAbbreviation", "IsDeleted", "CreatedAt", "UpdatedAt")
       VALUES ('Seed', 'Row', 'SED', 'USA', false, NOW(), NOW())`,
    );
  });

  await resetDb();

  await withE2eDb(async (client) => {
    const drivers = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "Drivers"`,
    );
    expect(drivers.rows[0]?.count).toBe('0');

    const migrations = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "__EFMigrationsHistory"`,
    );
    expect(Number(migrations.rows[0]?.count)).toBeGreaterThan(0);
  });
});
