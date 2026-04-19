import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { getCurrentSyncState, updateSyncState } from '@/storage/local/api';
import {
  authDisplayName,
  authEmail,
  authProviderLabel,
  buildAuthCallbackUrl,
  normalizeAuthNextPath,
} from '@/storage/sync/supabase/auth';
import { getSupabaseSyncStatus } from '@/storage/sync/supabase/config';
import { getSupabaseBrowserClient } from '@/storage/sync/supabase/client';

interface AuthContextValue {
  configured: boolean;
  displayName: string | null;
  email: string | null;
  error: string | null;
  isReady: boolean;
  magicLinkSentTo: string | null;
  providerLabel: string | null;
  session: Session | null;
  user: User | null;
  clearFeedback: () => void;
  continueWithGoogle: (nextPath?: string) => Promise<void>;
  sendMagicLink: (email: string, nextPath?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyErrorMessage(fallback: string, error: unknown): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseBrowserClient();
  const configured = Boolean(client);
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(!configured);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);

  const syncSessionToLocal = useEffectEvent(
    async (nextSession: Session | null) => {
      const syncStatus = getSupabaseSyncStatus();

      if (nextSession?.user?.id) {
        await updateSyncState({
          mode: syncStatus.configured ? 'ready' : 'disabled',
          authState: 'signed-in',
          identityState: 'member',
          remoteUserId: nextSession.user.id,
        });
        return;
      }

      const current = await getCurrentSyncState();
      await updateSyncState({
        mode: syncStatus.configured ? 'ready' : 'disabled',
        authState: 'signed-out',
        identityState:
          current.identityState === 'member' ? 'member' : 'device-guest',
        remoteUserId:
          current.identityState === 'member' ? current.remoteUserId : null,
      });
    },
  );

  useEffect(() => {
    if (!client) {
      setIsReady(true);
      return;
    }

    let cancelled = false;

    void client.auth
      .getSession()
      .then(async ({ data, error: sessionError }) => {
        if (cancelled) {
          return;
        }

        if (sessionError) {
          setError("Couldn't restore your session yet.");
        }

        setSession(data.session ?? null);
        setIsReady(true);
        await syncSessionToLocal(data.session ?? null);
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

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) {
        return;
      }

      setSession(nextSession);
      setIsReady(true);
      void syncSessionToLocal(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [client, syncSessionToLocal]);

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

    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      setError("Couldn't sign out. Try again.");
      return;
    }

    const current = await getCurrentSyncState();
    await updateSyncState({
      mode: getSupabaseSyncStatus().configured ? 'ready' : 'disabled',
      authState: 'signed-out',
      identityState:
        current.identityState === 'member' ? 'member' : 'device-guest',
      remoteUserId:
        current.identityState === 'member' ? current.remoteUserId : null,
    });
    setSession(null);
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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
