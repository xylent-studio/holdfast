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

export function parseSupabaseAuthHash(
  value: string,
):
  | { accessToken: string; refreshToken: string }
  | { error: string }
  | null {
  const hash = value.startsWith('#') ? value.slice(1) : value;
  if (!hash) {
    return null;
  }

  const params = new URLSearchParams(hash);
  const error =
    params.get('error_description') ??
    params.get('error') ??
    params.get('error_code');
  if (error) {
    return { error };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

function clearAuthHash(url: URL): void {
  if (!url.hash) {
    return;
  }

  url.hash = '';
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

export async function maybeRestoreSupabaseSessionFromUrl(
  client: SupabaseClient,
): Promise<{ error: string | null; handled: boolean; session: Session | null }> {
  const url = new URL(window.location.href);
  const parsedHash = parseSupabaseAuthHash(url.hash);

  if (parsedHash) {
    clearAuthHash(url);

    if ('error' in parsedHash) {
      return {
        error: "Couldn't finish sign-in. Try again.",
        handled: true,
        session: null,
      };
    }

    const { data, error } = await client.auth.setSession({
      access_token: parsedHash.accessToken,
      refresh_token: parsedHash.refreshToken,
    });

    if (error || !data.session) {
      return {
        error: "Couldn't finish sign-in. Try again.",
        handled: true,
        session: null,
      };
    }

    return {
      error: null,
      handled: true,
      session: data.session,
    };
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return {
      error: null,
      handled: false,
      session: null,
    };
  }

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    return {
      error: "Couldn't finish sign-in. Try again.",
      handled: true,
      session: null,
    };
  }

  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError || !data.session) {
    return {
      error: "Couldn't finish sign-in. Try again.",
      handled: true,
      session: null,
    };
  }

  return {
    error: null,
    handled: true,
    session: data.session,
  };
}

export async function finishSupabaseAuthRedirect(
  client: SupabaseClient,
): Promise<{ error: string | null; session: Session | null }> {
  const restored = await maybeRestoreSupabaseSessionFromUrl(client);
  if (restored.handled) {
    return {
      error: restored.error,
      session: restored.session,
    };
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
