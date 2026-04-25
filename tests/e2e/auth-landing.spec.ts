import { expect, test } from '@playwright/test';

test('shows the guest shell on a clean browser', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Now' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(
    page.getByText(
      'Using Holdfast locally on this device. Sign in when you want this workspace attached for sync.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
