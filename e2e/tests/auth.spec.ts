import { expect, test } from '@playwright/test';

import { createTestUser } from '../fixtures/auth';
import { resetDb } from '../fixtures/reset';
import { seedCurrentSeason, seedMinimalGrid } from '../fixtures/seed';
import { seedTeamForUser } from '../fixtures/team';

test.describe('auth', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('signs in with real credentials and lands on the leagues dashboard', async ({ page }) => {
    const user = await createTestUser();
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    await seedTeamForUser(user, {
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL('/leagues');
    await expect(page.getByRole('heading', { name: 'My Leagues' })).toBeVisible();
    await expect(page.getByText(user.displayName)).toBeVisible();
  });

  test('redirects unauthenticated visits to /my-team back to the landing page', async ({
    page,
  }) => {
    await page.goto('/my-team');

    await expect(page).toHaveURL('/');
  });

  test('sign out clears the session so protected routes redirect again', async ({ page }) => {
    const user = await createTestUser();
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    await seedTeamForUser(user, {
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/leagues');

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign Out' }).click();

    await expect(page).toHaveURL('/');

    await page.goto('/my-team');
    await expect(page).toHaveURL('/');
  });
});
