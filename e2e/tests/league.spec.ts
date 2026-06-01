import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { createTestUser } from '../fixtures/auth';
import { seedLeague, seedLeagueInvite } from '../fixtures/league';
import { resetDb } from '../fixtures/reset';
import { seedCurrentSeason, seedMinimalGrid } from '../fixtures/seed';
import { signInAs } from '../fixtures/session';
import { seedTeamForUser } from '../fixtures/team';

test.describe('league', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('User A creates a private league; User B joins via the invite URL in a second context', async ({
    browser,
  }) => {
    const userA = await createTestUser({ emailPrefix: 'league-owner' });
    const userB = await createTestUser({ emailPrefix: 'league-joiner' });
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    const constructors = grid.constructors.slice(0, 2).map((c) => c.id);
    const drivers = grid.drivers.slice(0, 5).map((d) => d.id);
    await seedTeamForUser(userA, { driverIds: drivers, constructorIds: constructors });
    await seedTeamForUser(userB, { driverIds: drivers, constructorIds: constructors });

    const leagueName = `Private Pit Wall ${randomUUID().slice(0, 8)}`;

    // User A: sign in, create the league, and grab the invite URL.
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signInAs(pageA, userA);

    await pageA.goto('/leagues');
    await pageA.getByRole('button', { name: 'Create League' }).click();
    const createDialog = pageA.getByRole('dialog', { name: 'Create League' });
    await createDialog.getByLabel('League Name').fill(leagueName);
    await createDialog.getByRole('button', { name: 'Submit' }).click();

    await expect(pageA).toHaveURL(/\/league\/\d+$/);
    await expect(pageA.getByRole('heading', { name: leagueName })).toBeVisible();

    await pageA.getByRole('button', { name: 'Invite' }).click();
    const inviteInput = pageA.getByLabel('League Invite Link');
    await expect(inviteInput).toHaveValue(/\/join\/[^/]+$/);
    const inviteUrl = await inviteInput.inputValue();
    await contextA.close();

    // User B: fresh context, sign in, open the invite URL, join.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signInAs(pageB, userB);

    await pageB.goto(inviteUrl);
    await expect(pageB.getByText(leagueName)).toBeVisible();
    await pageB.getByRole('button', { name: 'Join League' }).click();

    await expect(pageB).toHaveURL(/\/league\/\d+$/);
    await expect(pageB.getByRole('heading', { name: leagueName })).toBeVisible();
    await contextB.close();
  });

  test("User B browses available leagues, joins User A's public league from the list", async ({
    browser,
  }) => {
    const userA = await createTestUser({ emailPrefix: 'public-owner' });
    const userB = await createTestUser({ emailPrefix: 'public-browser' });
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    const constructors = grid.constructors.slice(0, 2).map((c) => c.id);
    const drivers = grid.drivers.slice(0, 5).map((d) => d.id);
    await seedTeamForUser(userA, { driverIds: drivers, constructorIds: constructors });
    await seedTeamForUser(userB, { driverIds: drivers, constructorIds: constructors });

    const leagueName = `Open Grid ${randomUUID().slice(0, 8)}`;
    const league = await seedLeague(userA, { name: leagueName, isPrivate: false });

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signInAs(pageB, userB);

    await pageB.goto('/browse-leagues');

    await expect(pageB.getByRole('heading', { name: leagueName })).toBeVisible();
    await pageB.getByRole('button', { name: 'Join League' }).click();

    const dialog = pageB.getByRole('alertdialog');
    await expect(dialog.getByRole('heading', { name: `Join ${leagueName}?` })).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm Join' }).click();

    await expect(pageB).toHaveURL(new RegExp(`/league/${league.id}$`));
    await expect(pageB.getByRole('heading', { name: leagueName })).toBeVisible();
    await contextB.close();
  });

  test('authenticated visitor without a team visits /join/$token, creates a team, and joins', async ({
    page,
  }) => {
    const owner = await createTestUser({ emailPrefix: 'owner' });
    const joiner = await createTestUser({ emailPrefix: 'joiner' });
    const season = await seedCurrentSeason();
    const grid = await seedMinimalGrid({ seasonId: season.id });
    await seedTeamForUser(owner, {
      driverIds: grid.drivers.slice(0, 5).map((d) => d.id),
      constructorIds: grid.constructors.slice(0, 2).map((c) => c.id),
    });
    const leagueName = `Open Paddock ${randomUUID().slice(0, 8)}`;
    const league = await seedLeague(owner, { name: leagueName, isPrivate: true });
    const invite = await seedLeagueInvite(owner, league.id);

    const joinPath = `/join/${invite.token}`;
    const teamName = `Team ${randomUUID().slice(0, 8)}`;

    await signInAs(page, joiner);

    await page.goto(joinPath);
    await expect(page.getByText(leagueName)).toBeVisible();

    // Authenticated but without a team — the invite page surfaces Create Team
    // with ?redirect=/join/${token} preserved through the team-creation round-trip.
    await page.getByRole('link', { name: 'Create Team' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/create-team\\?redirect=${encodeURIComponent(joinPath)}`),
    );

    await page.getByLabel('Team Name').fill(teamName);
    await page.locator('form').getByRole('button', { name: 'Create Team' }).click();

    // Back on the invite page once more, now authenticated with a team.
    await expect(page).toHaveURL(joinPath);
    await page.getByRole('button', { name: 'Join League' }).click();

    await expect(page).toHaveURL(new RegExp(`/league/${league.id}$`));
    await expect(page.getByRole('heading', { name: leagueName })).toBeVisible();
  });
});
