import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { useAuth } from '@/app/auth/AuthProvider';
import { db } from '@/storage/local/db';
import { syncHoldfastWithSupabase } from '@/storage/sync/supabase/engine';

interface SyncContextValue {
  isOnline: boolean;
  pendingMutationCount: number;
  retrySync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const pendingMutationCount =
    useLiveQuery(
      async () =>
        db.mutationQueue
          .filter(
            (mutation) =>
              mutation.status === 'pending' || mutation.status === 'failed',
          )
          .count(),
      [],
    ) ?? 0;

  const attemptSync = useEffectEvent(async () => {
    if (!auth.session || !auth.configured || !isOnline) {
      return;
    }

    try {
      await syncHoldfastWithSupabase();
    } catch {
      // Sync state is recorded in IndexedDB; keep the shell calm.
    }
  });

  const retrySync = async (): Promise<void> => {
    if (!auth.session || !auth.configured || !isOnline) {
      return;
    }

    try {
      await syncHoldfastWithSupabase();
    } catch {
      // Sync state is recorded in IndexedDB; keep the shell calm.
    }
  };

  useEffect(() => {
    const handleOnline = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    void attemptSync();
  }, [auth.configured, auth.session, isOnline, pendingMutationCount]);

  useEffect(() => {
    if (!auth.session || !auth.configured) {
      return;
    }

    const interval = window.setInterval(() => {
      void attemptSync();
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [auth.configured, auth.session]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        pendingMutationCount,
        retrySync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error('useSync must be used inside SyncProvider.');
  }

  return context;
}
