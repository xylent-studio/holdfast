import { expect, test } from '@playwright/test';

test('handles direct auth callback loads without a blank screen', async ({
  page,
}) => {
  await page.goto('/auth/callback?next=/now');

  await expect(
    page.getByRole('heading', { name: "Sign-in didn't finish." }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
});

test('keeps the shell reachable offline after the first load', async ({
  context,
  page,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  await page.goto('/review');

  await expect(
    page.getByRole('heading', { name: 'Stay in command of real life.' }),
  ).toBeVisible();

  await context.setOffline(false);
});
