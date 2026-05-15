import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { createTestUser } from '../fixtures/auth';
import { resetDb } from '../fixtures/reset';
import { seedCurrentSeason, seedMinimalGrid, seedRaceWeekend } from '../fixtures/seed';
import { signInAs } from '../fixtures/session';
import { seedTeamForUser } from '../fixtures/team';

test.describe('team', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('new user creates a team and lands on /my-team', async ({ page }) => {
    const user = await createTestUser();
    const teamName = `Team ${randomUUID().slice(0, 8)}`;

    await signInAs(page, user);
    await expect(page).toHaveURL('/create-team');

    await page.getByLabel('Team Name').fill(teamName);
    await page.locator('form').getByRole('button', { name: 'Create Team' }).click();

    await expect(page).toHaveURL('/my-team');
    await expect(page.getByRole('heading', { name: teamName })).toBeVisible();
    // Freshly-created team has an empty roster — all 5 slots show Add Driver.
    await expect(page.getByRole('button', { name: 'Add Driver' })).toHaveCount(5);
  });

  test('edit lineup within budget, set captain, reload — both persist', async ({ page }) => {
    const user = await createTestUser();
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    // seedMinimalGrid returns 8 drivers; this test uses the first 6. Assert
    // up front so a future grid-size regression fails here, loudly.
    expect(grid.drivers.length).toBeGreaterThanOrEqual(6);
    const [alex, bruno, carlo, dante, enzo, fabio] = grid.drivers;
    // setCaptain requires a current, unlocked race weekend. Seed one far out.
    const now = new Date();
    await seedRaceWeekend({
      seasonId: season.id,
      raceDate: new Date(now.getTime() + 7 * 86_400_000),
      lockDeadline: new Date(now.getTime() + 6 * 86_400_000),
    });
    await seedTeamForUser(user, {
      driverIds: [alex.id, bruno.id, carlo.id, dante.id, enzo.id],
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });

    await signInAs(page, user);
    await expect(page).toHaveURL('/leagues');

    await page.goto('/my-team');
    await expect(page.getByText(`${alex.firstName} ${alex.lastName}`)).toBeVisible();

    // Swap Alex for Fabio in slot 0: remove, then pick from the sheet.
    // Wait for the DELETE to settle before adding Fabio, otherwise the
    // server's budget check for the add can still see Alex on the roster.
    const removeResponse = page.waitForResponse(
      (res) => /\/me\/team\/drivers\/\d+$/.test(res.url()) && res.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: 'Remove driver' }).first().click();
    await removeResponse;
    await expect(page.getByText(`${alex.firstName} ${alex.lastName}`)).toBeHidden();

    await page.getByRole('button', { name: 'Add Driver' }).click();
    const driverSheet = page.getByRole('dialog', { name: 'Select Driver' });
    await driverSheet
      .getByRole('listitem')
      .filter({ hasText: `${fabio.firstName} ${fabio.lastName}` })
      .getByRole('button', { name: 'Add Driver' })
      .click();

    await expect(page.getByText(`${fabio.firstName} ${fabio.lastName}`)).toBeVisible();

    // Set Bruno as captain. Wait for the PUT to finish before reloading,
    // otherwise the reload aborts the in-flight request and the optimistic
    // UI flip never makes it to the DB.
    const captainResponse = page.waitForResponse(
      (res) => res.url().endsWith('/me/team/captain') && res.request().method() === 'PUT',
    );
    await page
      .getByRole('button', { name: `Set ${bruno.firstName} ${bruno.lastName} as captain` })
      .click();
    await captainResponse;
    await expect(page.getByRole('button', { name: 'Captain — 2× points (active)' })).toBeVisible();

    await page.reload();

    await expect(page.getByText(`${fabio.firstName} ${fabio.lastName}`)).toBeVisible();
    await expect(page.getByText(`${alex.firstName} ${alex.lastName}`)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Captain — 2× points (active)' })).toBeVisible();
  });

  test('past lock deadline disables pickers and shows Lineup Locked', async ({ page }) => {
    const user = await createTestUser();
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    await seedTeamForUser(user, {
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });

    const now = new Date();
    await seedRaceWeekend({
      seasonId: season.id,
      raceDate: new Date(now.getTime() + 2 * 86_400_000),
      lockDeadline: new Date(now.getTime() - 60 * 60_000),
    });

    await signInAs(page, user);
    await expect(page).toHaveURL('/leagues');

    await page.goto('/my-team');

    await expect(page.getByText('Lineup Locked')).toBeVisible();
    await expect(page.getByText('Lineup Locks In')).toBeHidden();
    // readOnly hides the per-driver remove button.
    await expect(page.getByRole('button', { name: 'Remove driver' })).toHaveCount(0);
  });
});
