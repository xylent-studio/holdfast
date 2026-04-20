import { expect, test } from '@playwright/test';

test('shows the signed-out landing on a clean browser', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Stay in command of real life.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Email me a sign-in link' }),
  ).toBeVisible();
});
