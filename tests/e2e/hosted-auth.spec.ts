import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() ?? '';
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? '';
const authSmokeEnabled = process.env.PLAYWRIGHT_AUTH_SMOKE === '1';

function authClient() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      'Hosted auth smoke needs VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.',
    );
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function createMagicLink(email: string, nextPath = '/settings') {
  const client = authClient();
  const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const { data, error } = await client.auth.admin.generateLink({
    type: 'magiclink',
    email,
    redirectTo,
  });

  if (error || !data?.properties?.action_link || !data.user?.id) {
    throw new Error(error?.message ?? 'Supabase did not return a hosted magic link.');
  }

  return {
    actionLink: data.properties.action_link,
    email,
    generatedRedirect: data.properties.redirect_to ?? null,
    userId: data.user.id,
  };
}

async function deleteUser(userId: string) {
  await authClient().auth.admin.deleteUser(userId).catch(() => undefined);
}

async function consumeMagicLink(actionLink: string, page: Page) {
  await page.goto(actionLink, { waitUntil: 'networkidle' });
}

async function openSignedInSettings(page: Page) {
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
}

async function clearSupabaseSession(page: Page) {
  await page.evaluate(() => {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && key.includes('auth-token')) {
          keys.push(key);
        }
      }
      keys.forEach((key) => storage.removeItem(key));
    }
  });
}

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
      page.getByRole('heading', { name: 'Stay in command of real life.' }),
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
