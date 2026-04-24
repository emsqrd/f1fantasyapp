import { expect, test } from '@playwright/test';

import { createTestUser } from '../fixtures/auth';
import { withE2eDb } from '../fixtures/db';
import { resetDb } from '../fixtures/reset';

test('resetDb clears public app data, auth users, and storage objects', async () => {
  await withE2eDb(async (client) => {
    await client.query(
      `INSERT INTO "Drivers" ("FirstName", "LastName", "Abbreviation",
        "CountryAbbreviation", "IsDeleted", "CreatedAt", "UpdatedAt")
       VALUES ('Seed', 'Row', 'SED', 'USA', false, NOW(), NOW())`,
    );
  });

  // Creating an auth user also populates Accounts + UserProfiles via the
  // profile-creation trigger — exercises the cross-schema cleanup.
  await createTestUser();

  await resetDb();

  await withE2eDb(async (client) => {
    const drivers = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "Drivers"`,
    );
    expect(drivers.rows[0]?.count).toBe('0');

    const accounts = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "Accounts"`,
    );
    expect(accounts.rows[0]?.count).toBe('0');

    const authUsers = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM auth.users`,
    );
    expect(authUsers.rows[0]?.count).toBe('0');

    const storageObjects = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM storage.objects`,
    );
    expect(storageObjects.rows[0]?.count).toBe('0');

    const migrations = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "__EFMigrationsHistory"`,
    );
    expect(Number(migrations.rows[0]?.count)).toBeGreaterThan(0);
  });
});
