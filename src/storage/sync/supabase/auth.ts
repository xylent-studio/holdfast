import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

const DEFAULT_NEXT_PATH = '/now';

function relativePath(value: string): string | null {
  if (!value.startsWith('/')) {
    return null;
  }

  if (value.startsWith('//')) {
    return null;
  }

  return value;
}

export function normalizeAuthNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_NEXT_PATH,
): string {
  const safeValue = value ? relativePath(value) : null;
  if (!safeValue || safeValue.startsWith('/auth/callback')) {
    return fallback;
  }

  return safeValue;
}

export function buildAuthCallbackUrl(nextPath?: string): string {
  const url = new URL('/auth/callback', window.location.origin);
  url.searchParams.set('next', normalizeAuthNextPath(nextPath));
  return url.toString();
}

export async function finishSupabaseAuthRedirect(
  client: SupabaseClient,
): Promise<{ error: string | null; session: Session | null }> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      return {
        error: "Couldn't finish sign-in. Try again.",
        session: null,
      };
    }
  }

  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    return {
      error: "Couldn't finish sign-in. Try again.",
      session: null,
    };
  }

  return {
    error: null,
    session: data.session,
  };
}

export function authEmail(user: User | null): string | null {
  return user?.email ?? null;
}

export function authDisplayName(user: User | null): string | null {
  if (!user) {
    return null;
  }

  const value =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : null;

  if (value?.trim()) {
    return value.trim();
  }

  const email = authEmail(user);
  return email ? (email.split('@')[0] ?? null) : null;
}

export function authProviderLabel(user: User | null): string | null {
  const provider = user?.app_metadata?.provider;

  if (provider === 'google') {
    return 'Google';
  }

  if (provider === 'email') {
    return 'Email';
  }

  return provider ? String(provider) : null;
}
