import type { Page } from '@playwright/test';

import type { TestUser } from './auth';

/**
 * Signs in via the real UI form. Leaves URL assertions to the caller —
 * some tests land on `/leagues`, others on a preserved `redirect` target.
 */
export async function signInAs(page: Page, user: TestUser): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
}
