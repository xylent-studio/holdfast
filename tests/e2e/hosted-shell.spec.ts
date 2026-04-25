import { expect, test } from '@playwright/test';

async function activeServiceWorkerBuildId(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return null;
    }

    const controller = navigator.serviceWorker.controller;
    return await new Promise<string | null>((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve(null), 1_000);
      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout);
        resolve((event.data?.buildId as string | null) ?? null);
      };
      controller.postMessage({ type: 'HOLDFAST_GET_METADATA' }, [channel.port2]);
    });
  });
}

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

test('recovers from a legacy service worker controller without leaving the shell blank', async ({
  page,
}) => {
  await page.goto('/test-legacy-bootstrap.html');
  await expect(page.getByText('Legacy service worker ready')).toBeVisible();

  await page.goto('/review', { waitUntil: 'networkidle' });
  await expect
    .poll(
      async () => {
        if (
          await page
            .getByRole('heading', { name: 'Review' })
            .isVisible()
            .catch(() => false)
        ) {
          return 'review';
        }

        if (
          await page
            .getByRole('button', { name: 'Continue with Google' })
            .isVisible()
            .catch(() => false)
        ) {
          return 'landing';
        }

        return null;
      },
      { timeout: 10_000 },
    )
    .not.toBeNull();

  await expect
    .poll(async () => activeServiceWorkerBuildId(page), { timeout: 15_000 })
    .not.toBe('legacy-test-build');
});

test('keeps the shell reachable offline after the first load', async ({
  context,
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state === 'activated';
  });
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready;
    return Boolean(navigator.serviceWorker.controller);
  });

  await context.setOffline(true);
  const shellAvailableOffline = await page.evaluate(async () => {
    const response = await fetch('/index.html');
    const html = await response.text();
    return response.ok && html.includes('<div id="root"></div>');
  });

  expect(shellAvailableOffline).toBe(true);
  await expect(page.getByRole('heading', { name: 'Now' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  await context.setOffline(false);
});
