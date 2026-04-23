import { expect, test } from '@playwright/test';
import { storageStatePath, TEST_USERS } from '../fixtures/auth';

for (const user of TEST_USERS) {
  test.describe(`storage state: ${user.key}`, () => {
    test.use({ storageState: storageStatePath(user.key) });

    test(`authenticated session lets ${user.key} reach a protected route`, async ({ page }) => {
      await page.goto('/leagues');
      await expect(page).toHaveURL(/^(?!.*\/sign-in).*$/);
    });
  });
}
