import { expect, test } from '@playwright/test';

import {
  baseUrl,
  clearSupabaseSession,
  consumeMagicLink,
  createMagicLink,
  deleteUser,
  openSignedInSettings,
  supabaseSecretKey,
  supabaseUrl,
} from './hosted-auth.helpers';

const authSmokeEnabled = process.env.PLAYWRIGHT_AUTH_SMOKE === '1';

test.describe('hosted auth smoke', () => {
  test.skip(
    !authSmokeEnabled || !baseUrl || !supabaseUrl || !supabaseSecretKey,
    'Hosted auth smoke needs PLAYWRIGHT_AUTH_SMOKE, PLAYWRIGHT_BASE_URL, VITE_SUPABASE_URL, and SUPABASE_SECRET_KEY.',
  );

  const createdUserIds: string[] = [];

  test.afterEach(async () => {
    while (createdUserIds.length) {
      const userId = createdUserIds.pop();
      if (userId) {
        await deleteUser(userId);
      }
    }
  });

  test('signs in to the hosted app through a generated magic link', async ({
    page,
  }) => {
    const email = `holdfast-auth-${Date.now()}@example.com`;
    const link = await createMagicLink(email);
    createdUserIds.push(link.userId);

    expect(link.generatedRedirect?.startsWith(baseUrl)).toBe(true);

    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        name: 'Keep the real-life things you need close.',
      }),
    ).toBeVisible();

    await consumeMagicLink(link.actionLink, page);
    await openSignedInSettings(page);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test('shows session recovery after the hosted session is removed locally', async ({
    page,
  }) => {
    const email = `holdfast-recovery-${Date.now()}@example.com`;
    const link = await createMagicLink(email);
    createdUserIds.push(link.userId);

    await consumeMagicLink(link.actionLink, page);
    await openSignedInSettings(page);
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    await clearSupabaseSession(page);
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    await expect(
      page.getByText('Sign in again to keep this device in sync.'),
    ).toBeVisible();
    await expect(
      page.getByText("We'll keep what's already here and sync it to your account."),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Continue with Google' }),
    ).toBeVisible();
  });

  test('protects a member-owned local workspace from a different account', async ({
    page,
  }) => {
    const firstEmail = `holdfast-owner-a-${Date.now()}@example.com`;
    const secondEmail = `holdfast-owner-b-${Date.now()}@example.com`;
    const firstLink = await createMagicLink(firstEmail);
    const secondLink = await createMagicLink(secondEmail);
    createdUserIds.push(firstLink.userId, secondLink.userId);

    await consumeMagicLink(firstLink.actionLink, page);
    await openSignedInSettings(page);
    await expect(page.getByText(firstEmail, { exact: true })).toBeVisible();

    await clearSupabaseSession(page);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(
      page.getByText('Sign in again to keep this device in sync.'),
    ).toBeVisible();

    await consumeMagicLink(secondLink.actionLink, page);
    await page.goto('/settings', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    await expect(
      page.getByText("This device is still holding another account's workspace."),
    ).toBeVisible();
    await expect(page.getByText('Needs the original account')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Continue with Google' }),
    ).toBeVisible();
    await expect(page.getByText(secondEmail, { exact: true })).toHaveCount(0);
  });
});
