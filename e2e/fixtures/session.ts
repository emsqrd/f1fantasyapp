import type { Page } from '@playwright/test';

import type { TestUser } from './auth';

/**
 * Signs in via the real UI form and waits for the sign-in navigation to
 * settle. Callers decide whether to assert the landing URL
 * (`/` or a preserved `redirect` target) — the wait here only guarantees
 * the session is usable, not where it landed.
 */
export async function signInAs(page: Page, user: TestUser): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
  // SignInForm awaits navigate() but the helper's caller may `goto` the
  // very next tick and race the redirect. Block here until the URL has
  // left `/sign-in`.
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'));
}
