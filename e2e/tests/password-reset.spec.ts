import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { createTestUser } from '../fixtures/auth';
import { clearAll, getRecoveryUrl, searchByRecipient } from '../fixtures/mailpit';
import { resetDb } from '../fixtures/reset';
import { signInAs } from '../fixtures/session';

test.describe('password reset', () => {
  test.beforeEach(async () => {
    await resetDb();
    await clearAll();
  });

  test('resets the password via the emailed link and signs in with the new one', async ({
    page,
  }) => {
    const user = await createTestUser({ emailPrefix: 'reset' });
    const newPassword = `new-e2e-${randomUUID().slice(0, 8)}`;

    await page.goto('/sign-in');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL('/forgot-password');

    await page.getByLabel('Email Address').fill(user.email);
    await page.locator('form').getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText(user.email)).toBeVisible();

    await expect
      .poll(async () => (await searchByRecipient(user.email)).count, { timeout: 10_000 })
      .toBe(1);

    const recoveryUrl = await getRecoveryUrl(user.email);
    await page.goto(recoveryUrl);

    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.getByText('Set a new password')).toBeVisible();
    // The emailed token stays unspent until submit, so the visitor is still
    // anonymous on the reset page.
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeHidden();

    await page.getByLabel('New Password').fill(newPassword);
    await page.getByLabel('Confirm Password').fill(newPassword);
    await page.getByRole('button', { name: 'Update password' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: `Welcome, ${user.displayName}` })).toBeVisible();

    await expect
      .poll(
        async () =>
          (await searchByRecipient(user.email, { subject: 'Your F1 Fantasy password was changed' }))
            .count,
        { timeout: 10_000 },
      )
      .toBe(1);

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign Out' }).click();
    await expect(page.getByRole('heading', { name: /race to glory/i })).toBeVisible();

    // The reset is only real if the new password authenticates on its own.
    await signInAs(page, { ...user, password: newPassword });

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: `Welcome, ${user.displayName}` })).toBeVisible();
  });

  test('the tab that requested the reset leaves the anonymous form once another tab completes it', async ({
    context,
  }) => {
    const user = await createTestUser({ emailPrefix: 'reset-tabs' });
    const newPassword = `new-e2e-${randomUUID().slice(0, 8)}`;

    const requestTab = await context.newPage();
    await requestTab.goto('/forgot-password');
    await requestTab.getByLabel('Email Address').fill(user.email);
    await requestTab.locator('form').getByRole('button', { name: 'Send reset link' }).click();
    await expect(requestTab.getByText('Check your email')).toBeVisible();

    await expect
      .poll(async () => (await searchByRecipient(user.email)).count, { timeout: 10_000 })
      .toBe(1);

    const emailTab = await context.newPage();
    await emailTab.goto(await getRecoveryUrl(user.email));
    await emailTab.getByLabel('New Password').fill(newPassword);
    await emailTab.getByLabel('Confirm Password').fill(newPassword);
    await emailTab.getByRole('button', { name: 'Update password' }).click();
    await expect(emailTab).toHaveURL('/');

    // The request tab did nothing: the session reaches it through supabase-js's
    // cross-tab sync, which re-runs the route guard on a now-authenticated
    // visitor. Left on /forgot-password it would draw the app shell around a
    // signed-out form.
    await expect(requestTab).toHaveURL('/');
    await expect(requestTab.getByRole('button', { name: 'Account menu' })).toBeVisible();
  });
});
