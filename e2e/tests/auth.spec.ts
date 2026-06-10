import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { createTestUser } from '../fixtures/auth';
import { seedLeague, seedLeagueInvite } from '../fixtures/league';
import { clearAll, getMessage, searchByRecipient } from '../fixtures/mailpit';
import { resetDb } from '../fixtures/reset';
import { seedCurrentSeason, seedMinimalGrid } from '../fixtures/seed';
import { signInAs } from '../fixtures/session';
import { seedTeamForUser } from '../fixtures/team';

test.describe('auth', () => {
  test.beforeEach(async () => {
    await resetDb();
    await clearAll();
  });

  test('signs in with real credentials and lands on home', async ({ page }) => {
    const user = await createTestUser();
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    await seedTeamForUser(user, {
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });

    await signInAs(page, user);

    await expect(page).toHaveURL('/');
    await expect(page.getByText(/riding solo/i)).toBeVisible();
    await expect(page.getByText(`Welcome back, ${user.displayName}`)).toBeVisible();
  });

  test('redirects unauthenticated visits to /my-team back to the landing page', async ({
    page,
  }) => {
    await page.goto('/my-team');

    await expect(page).toHaveURL('/');
  });

  test('completes signup via the magic link in the confirmation email', async ({ page }) => {
    const unique = randomUUID();
    const email = `signup-link-${unique}@e2e.local`;
    const password = 'e2e-password';
    const displayName = `Test Link ${unique.slice(0, 8)}`;

    await page.goto('/sign-up');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.locator('form').getByRole('button', { name: 'Sign Up' }).click();

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    await expect
      .poll(async () => (await searchByRecipient(email)).count, { timeout: 10_000 })
      .toBe(1);

    const search = await searchByRecipient(email);
    const message = await getMessage(search.messages[0].ID);
    const linkMatch = message.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
    if (!linkMatch) throw new Error('Could not find confirmation URL in email HTML');
    const confirmationUrl = linkMatch[1].replace(/&amp;/g, '&');

    await page.goto(confirmationUrl);
    await expect(page).toHaveURL(/\/auth\/confirm/);
    await expect(page.getByRole('heading', { name: /confirm your email/i })).toBeVisible();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create team/i })).toBeVisible();
  });

  test('completes signup via the OTP code from the confirmation email', async ({ page }) => {
    const unique = randomUUID();
    const email = `signup-otp-${unique}@e2e.local`;
    const password = 'e2e-password';
    const displayName = `Test OTP ${unique.slice(0, 8)}`;

    await page.goto('/sign-up');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.locator('form').getByRole('button', { name: 'Sign Up' }).click();

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    await expect
      .poll(async () => (await searchByRecipient(email)).count, { timeout: 10_000 })
      .toBe(1);

    const search = await searchByRecipient(email);
    const message = await getMessage(search.messages[0].ID);
    const tokenMatch = message.Text.match(/\b(\d{6})\b/);
    if (!tokenMatch) throw new Error('Could not find OTP token in email text');

    await page.getByLabel('Confirmation code').fill(tokenMatch[1]);

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });

  test('resends the confirmation email and confirms via the resent link', async ({ page }) => {
    const unique = randomUUID();
    const email = `signup-resend-${unique}@e2e.local`;
    const password = 'e2e-password';
    const displayName = `Test Resend ${unique.slice(0, 8)}`;

    await page.goto('/sign-up');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.locator('form').getByRole('button', { name: 'Sign Up' }).click();

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    await expect
      .poll(async () => (await searchByRecipient(email)).count, { timeout: 10_000 })
      .toBe(1);

    await page.getByRole('button', { name: 'Resend the code' }).click();

    await expect
      .poll(async () => (await searchByRecipient(email)).count, { timeout: 10_000 })
      .toBe(2);

    // Mailpit returns messages newest-first; [0] is the resent email.
    const search = await searchByRecipient(email);
    const message = await getMessage(search.messages[0].ID);
    const linkMatch = message.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
    if (!linkMatch) throw new Error('Could not find confirmation URL in resent email HTML');
    const confirmationUrl = linkMatch[1].replace(/&amp;/g, '&');

    await page.goto(confirmationUrl);
    await expect(page).toHaveURL(/\/auth\/confirm/);
    await expect(page.getByRole('heading', { name: /confirm your email/i })).toBeVisible();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });

  test('lands on /sign-up with the inline error when the magic link token is invalid', async ({
    page,
  }) => {
    const unique = randomUUID();
    const email = `signup-expired-${unique}@e2e.local`;
    const password = 'e2e-password';
    const displayName = `Test Expired ${unique.slice(0, 8)}`;

    await page.goto('/sign-up');
    await page.getByLabel('Display Name').fill(displayName);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.locator('form').getByRole('button', { name: 'Sign Up' }).click();

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    await expect
      .poll(async () => (await searchByRecipient(email)).count, { timeout: 10_000 })
      .toBe(1);

    const search = await searchByRecipient(email);
    const message = await getMessage(search.messages[0].ID);
    const linkMatch = message.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
    if (!linkMatch) throw new Error('Could not find confirmation URL in email HTML');
    const confirmationUrl = linkMatch[1].replace(/&amp;/g, '&');
    const brokenUrl = confirmationUrl.replace(
      /token_hash=[^&]+/,
      'token_hash=pkce_invalidinvalidinvalidinvalid',
    );

    await page.goto(brokenUrl);
    await expect(page).toHaveURL(/\/auth\/confirm/);
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/sign-up\?confirmationError=/);
    await expect(page.getByRole('alert')).toContainText(/couldn't confirm|no longer valid/i);
  });

  test('preserves /join/<token> across browsers via emailRedirectTo', async ({ browser }) => {
    const owner = await createTestUser({ emailPrefix: 'cross-owner' });
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    await seedTeamForUser(owner, {
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });
    const leagueName = `Cross-Browser Paddock ${randomUUID().slice(0, 8)}`;
    const league = await seedLeague(owner, { name: leagueName, isPrivate: true });
    const invite = await seedLeagueInvite(owner, league.id);
    const joinPath = `/join/${invite.token}`;

    const unique = randomUUID();
    const email = `cross-browser-${unique}@e2e.local`;
    const password = 'e2e-password';
    const displayName = `Cross ${unique.slice(0, 8)}`;

    // Browser A signs up, then closes. Browser B opens the magic link with
    // zero shared storage and must still verify — the token hash in the URL
    // is the only proof of identity, so verifyOtp succeeds without any
    // code_verifier or session data from A. This is the cross-device
    // property that PKCE couldn't satisfy.
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto(`/sign-up?redirect=${encodeURIComponent(joinPath)}`);
    await pageA.getByLabel('Display Name').fill(displayName);
    await pageA.getByLabel('Email').fill(email);
    await pageA.getByLabel('Password', { exact: true }).fill(password);
    await pageA.getByLabel('Confirm Password').fill(password);
    await pageA.locator('form').getByRole('button', { name: 'Sign Up' }).click();
    await expect(pageA.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await contextA.close();

    await expect
      .poll(async () => (await searchByRecipient(email)).count, { timeout: 10_000 })
      .toBe(1);
    const search = await searchByRecipient(email);
    const message = await getMessage(search.messages[0].ID);
    const linkMatch = message.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
    if (!linkMatch) throw new Error('Could not find confirmation URL in email HTML');
    const confirmationUrl = linkMatch[1].replace(/&amp;/g, '&');

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto(confirmationUrl);
    await expect(pageB).toHaveURL(/\/auth\/confirm/);
    await pageB.getByRole('button', { name: /continue/i }).click();
    await expect(pageB).toHaveURL(new RegExp(`/join/${invite.token}$`));
    await expect(pageB.getByText(leagueName)).toBeVisible();
    await contextB.close();
  });

  test('sign out clears the session so protected routes redirect again', async ({ page }) => {
    const user = await createTestUser();
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    await seedTeamForUser(user, {
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });

    await signInAs(page, user);
    await expect(page).toHaveURL('/');

    // Sign out from a guarded page: its loaders are the ones the sign-out
    // re-runs, which is the surface that used to fire 401s with the cleared
    // session and dead-end on the error fallback.
    await page.goto('/my-team');
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign Out' }).click();

    // Sign-in and sign-out both land on `/`, so the URL can't confirm the
    // session cleared. The landing page hero renders only when logged out —
    // wait for it before probing a protected route. The Sign In button alone
    // is not enough: the error fallback's banner also shows one.
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /race to glory/i })).toBeVisible();
    await expect(page.getByText('Something went wrong!')).not.toBeVisible();

    await page.goto('/my-team');
    await expect(page).toHaveURL('/');
  });
});
