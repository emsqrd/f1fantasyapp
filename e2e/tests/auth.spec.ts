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

  test('signs in with real credentials and lands on the leagues dashboard', async ({ page }) => {
    const user = await createTestUser();
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    await seedTeamForUser(user, {
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });

    await signInAs(page, user);

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
    const linkMatch = message.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
    if (!linkMatch) throw new Error('Could not find confirmation URL in email HTML');
    const confirmationUrl = linkMatch[1].replace(/&amp;/g, '&');

    await page.goto(confirmationUrl);
    await expect(page).toHaveURL('/create-team');
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

    await expect(page).toHaveURL('/create-team');
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
    const linkMatch = message.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
    if (!linkMatch) throw new Error('Could not find confirmation URL in resent email HTML');
    const confirmationUrl = linkMatch[1].replace(/&amp;/g, '&');

    await page.goto(confirmationUrl);
    await expect(page).toHaveURL('/create-team');
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

    // Browser A: sign up on /sign-up?redirect=<joinPath>, then close. The
    // signup-side context shares no storage with Browser B, so the implicit
    // flow's auto-detect on B has to work from URL fragment alone — the
    // failure mode that killed PKCE during the rework.
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
    const linkMatch = message.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
    if (!linkMatch) throw new Error('Could not find confirmation URL in email HTML');
    const confirmationUrl = linkMatch[1].replace(/&amp;/g, '&');

    // Browser B: fresh context with zero prior auth state. Supabase's SDK
    // strips the access_token fragment after parsing but leaves a bare `#`,
    // hence the optional trailing `#` in the URL match.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto(confirmationUrl);
    await expect(pageB).toHaveURL(new RegExp(`/join/${invite.token}#?$`));
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
    await expect(page).toHaveURL('/leagues');

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign Out' }).click();

    await expect(page).toHaveURL('/');

    await page.goto('/my-team');
    await expect(page).toHaveURL('/');
  });
});
