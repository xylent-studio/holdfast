import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { AuthContext, type AuthContextValue } from '@/app/auth/context';
import {
  hasAuthOwnerMismatch,
  hasUnresolvedMemberOwner,
  resolveSignedOutAuthPromptState,
  signedInAuthPatch,
  signedOutAuthPatch,
} from '@/app/auth/sync-state';
import {
  getCurrentWorkspaceState,
  updateWorkspaceState,
} from '@/storage/local/api';
import {
  authDisplayName,
  authEmail,
  authProviderLabel,
  buildAuthCallbackUrl,
  maybeRestoreSupabaseSessionFromUrl,
  normalizeAuthNextPath,
} from '@/storage/sync/supabase/auth';
import { getSupabaseBrowserClient } from '@/storage/sync/supabase/client';
import type { SyncAuthPromptState } from '@/domain/schemas/records';

const AUTH_RESTORE_TIMEOUT_MS = 15_000;

function friendlyErrorMessage(fallback: string, error: unknown): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeout);
        reject(error);
      });
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseBrowserClient();
  const configured = Boolean(client);
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(!configured);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);
  const pendingSignedOutPromptRef = useRef<SyncAuthPromptState | null>(null);

  const syncSessionToLocal = useEffectEvent(
    async (nextSession: Session | null) => {
      const current = await getCurrentWorkspaceState();

      if (nextSession?.user?.id) {
        if (hasUnresolvedMemberOwner(current)) {
          pendingSignedOutPromptRef.current = 'session-expired';
          await updateWorkspaceState(
            signedOutAuthPatch(current, 'session-expired'),
          );
          setError(
            'This device has synced work from an earlier account, but this install cannot prove which account owns it. Sign back into the original account after recovery, or remove this device data first.',
          );
          const { error: signOutError } = await client!.auth.signOut();
          if (signOutError) {
            pendingSignedOutPromptRef.current = null;
            throw signOutError;
          }
          return null;
        }

        if (hasAuthOwnerMismatch(current, nextSession.user.id)) {
          pendingSignedOutPromptRef.current = 'account-mismatch';
          await updateWorkspaceState(
            signedOutAuthPatch(current, 'account-mismatch'),
          );
          setError(
            "This device is still holding another account's workspace. Sign back into that account to keep syncing here.",
          );
          const { error: signOutError } = await client!.auth.signOut();
          if (signOutError) {
            pendingSignedOutPromptRef.current = null;
            throw signOutError;
          }
          return null;
        }

        await updateWorkspaceState(signedInAuthPatch(nextSession.user.id));
        return nextSession;
      }

      const promptState = resolveSignedOutAuthPromptState(
        current,
        pendingSignedOutPromptRef.current,
      );
      pendingSignedOutPromptRef.current = null;
      await updateWorkspaceState(signedOutAuthPatch(current, promptState));
      return null;
    },
  );

  useEffect(() => {
    if (!client) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const restored = await withTimeout(
        maybeRestoreSupabaseSessionFromUrl(client),
        AUTH_RESTORE_TIMEOUT_MS,
        "Couldn't restore your session yet.",
      );
      if (cancelled) {
        return;
      }

      if (restored.handled) {
        if (restored.error) {
          setError(restored.error);
        }

        const resolvedSession = await syncSessionToLocal(restored.session);
        if (cancelled) {
          return;
        }

        setSession(resolvedSession);
        setIsReady(true);
        return;
      }

      const { data, error: sessionError } = await withTimeout(
        client.auth.getSession(),
        AUTH_RESTORE_TIMEOUT_MS,
        "Couldn't restore your session yet.",
      );
        if (cancelled) {
          return;
        }

        if (sessionError) {
          setError("Couldn't restore your session yet.");
        }

        const resolvedSession = await syncSessionToLocal(data.session ?? null);
        if (cancelled) {
          return;
        }

        setSession(resolvedSession);
        setIsReady(true);
      })().catch((caughtError) => {
        if (cancelled) {
          return;
        }

        setError(
          friendlyErrorMessage(
            "Couldn't restore your session yet.",
            caughtError,
          ),
        );
        setIsReady(true);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      void syncSessionToLocal(nextSession)
        .then((resolvedSession) => {
          if (cancelled) {
            return;
          }

          setSession(resolvedSession);
          setIsReady(true);
        })
        .catch((caughtError) => {
          if (cancelled) {
            return;
          }

          setError(
            friendlyErrorMessage(
              "Couldn't restore your session yet.",
              caughtError,
            ),
          );
          setIsReady(true);
        });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [client]);

  const clearFeedback = (): void => {
    setError(null);
    setMagicLinkSentTo(null);
  };

  const continueWithGoogle = async (nextPath?: string): Promise<void> => {
    clearFeedback();

    if (!client) {
      setError("Account setup isn't ready yet.");
      return;
    }

    const { error: signInError } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildAuthCallbackUrl(normalizeAuthNextPath(nextPath)),
      },
    });

    if (signInError) {
      setError("Couldn't start Google sign-in. Try again.");
    }
  };

  const sendMagicLink = async (
    email: string,
    nextPath?: string,
  ): Promise<boolean> => {
    clearFeedback();

    if (!client) {
      setError("Account setup isn't ready yet.");
      return false;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your email address first.');
      return false;
    }

    const { error: signInError } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(normalizeAuthNextPath(nextPath)),
      },
    });

    if (signInError) {
      setError("Couldn't send the sign-in link. Try again.");
      return false;
    }

    setMagicLinkSentTo(normalizedEmail);
    return true;
  };

  const signOut = async (): Promise<void> => {
    clearFeedback();

    if (!client) {
      return;
    }

    pendingSignedOutPromptRef.current = 'signed-out-by-user';
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      pendingSignedOutPromptRef.current = null;
      setError("Couldn't sign out. Try again.");
    }
  };

  const value: AuthContextValue = {
    configured,
    displayName: authDisplayName(session?.user ?? null),
    email: authEmail(session?.user ?? null),
    error,
    isReady,
    magicLinkSentTo,
    providerLabel: authProviderLabel(session?.user ?? null),
    session,
    user: session?.user ?? null,
    clearFeedback,
    continueWithGoogle,
    sendMagicLink,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
