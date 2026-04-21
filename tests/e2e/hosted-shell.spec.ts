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
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration?.active);
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  const shellAvailableOffline = await page.evaluate(async () => {
    const response = await fetch('/index.html');
    const html = await response.text();
    return response.ok && html.includes('<div id="root"></div>');
  });

  expect(shellAvailableOffline).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();

  await context.setOffline(false);
});
