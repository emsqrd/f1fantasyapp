import { expect, test } from '@playwright/test';

import { createTestUser } from '../fixtures/auth';
import { resetDb } from '../fixtures/reset';
import { signInAs } from '../fixtures/session';

// 1×1 transparent PNG — small enough to keep fixtures inline, large enough
// that Radix AvatarImage's own preload resolves and renders the <img>.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test.describe('avatar', () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test('uploading on /account persists the public URL and propagates to the sidebar', async ({
    page,
  }) => {
    const user = await createTestUser();

    await signInAs(page, user);

    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Profile Information' })).toBeVisible();

    // AvatarUpload hides its <input type="file"> but leaves the aria-label
    // in place; setInputFiles drives it directly.
    const profilePatch = page.waitForResponse(
      (res) => res.url().endsWith('/me/profile') && res.request().method() === 'PATCH' && res.ok(),
    );
    await page.getByLabel('Upload avatar image').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    });

    const updatedProfile = (await (await profilePatch).json()) as { avatarUrl: string };
    expect(updatedProfile.avatarUrl).toMatch(
      new RegExp(`/storage/v1/object/public/avatars/${user.id}/`),
    );

    // Account card's AvatarImage renders once the URL resolves.
    await expect(page.getByRole('img', { name: 'Current avatar' })).toHaveAttribute(
      'src',
      updatedProfile.avatarUrl,
    );

    // Sidebar picks up the same URL via avatarEvents — the only path by
    // which a non-Account-page surface learns about the upload.
    await expect(
      page.getByRole('button', { name: 'Account menu' }).getByRole('img', { name: 'User avatar' }),
    ).toHaveAttribute('src', updatedProfile.avatarUrl);

    // Persisted across reload — proves the PATCH landed, not just the
    // optimistic in-memory state.
    await page.reload();
    await expect(page.getByRole('img', { name: 'Current avatar' })).toHaveAttribute(
      'src',
      updatedProfile.avatarUrl,
    );
  });
});
