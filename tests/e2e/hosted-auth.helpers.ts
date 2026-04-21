import { createClient } from '@supabase/supabase-js';
import { expect, type Page } from '@playwright/test';

export const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() ?? '';
export const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() ?? '';
export const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? '';

export function authClient() {
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

export async function createMagicLink(email: string, nextPath = '/settings') {
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

export async function deleteUser(userId: string) {
  await authClient().auth.admin.deleteUser(userId).catch(() => undefined);
}

export async function consumeMagicLink(actionLink: string, page: Page) {
  await page.goto(actionLink, { waitUntil: 'networkidle' });
}

export async function openSignedInSettings(page: Page) {
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
}

export async function clearSupabaseSession(page: Page) {
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

async function pollFor<T>(
  read: () => Promise<T | null>,
  description: string,
  timeoutMs = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await read();
    if (value) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${description}.`);
}

export async function waitForRemoteItemByTitle(
  userId: string,
  title: string,
  timeoutMs?: number,
) {
  return pollFor(
    async () => {
      const { data, error } = await authClient()
        .from('items')
        .select('id,title,body,status,updated_at')
        .eq('user_id', userId)
        .eq('title', title)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ?? null;
    },
    `remote item "${title}"`,
    timeoutMs,
  );
}

export async function waitForRemoteItemTitle(
  userId: string,
  itemId: string,
  title: string,
  timeoutMs?: number,
) {
  return pollFor(
    async () => {
      const { data, error } = await authClient()
        .from('items')
        .select('id,title,body,status,updated_at')
        .eq('user_id', userId)
        .eq('id', itemId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.title !== title) {
        return null;
      }

      return data;
    },
    `remote item "${itemId}" with title "${title}"`,
    timeoutMs,
  );
}

export async function waitForRemoteAttachment(
  userId: string,
  itemId: string,
  name: string,
  timeoutMs?: number,
) {
  return pollFor(
    async () => {
      const { data, error } = await authClient()
        .from('attachments')
        .select('id,item_id,name,storage_path,updated_at')
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .eq('name', name)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ?? null;
    },
    `remote attachment "${name}"`,
    timeoutMs,
  );
}

export async function reloadUntilTextVisible(
  page: Page,
  text: string,
  attempts = 6,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await page.reload({ waitUntil: 'networkidle' });
    const match = page.getByText(text, { exact: true });
    if (await match.count()) {
      await expect(match).toBeVisible();
      return;
    }

    await page.waitForTimeout(750);
  }

  throw new Error(`Timed out waiting for "${text}" after reloads.`);
}
