import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { useAuth } from '@/app/auth/useAuth';
import { SyncContext } from '@/app/sync/context';
import { db } from '@/storage/local/db';

async function runSupabaseSync(): Promise<void> {
  const { syncHoldfastWithSupabase } =
    await import('@/storage/sync/supabase/engine');

  await syncHoldfastWithSupabase();
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const mutationCounts =
    useLiveQuery(async () => {
      const mutations = await db.mutationQueue.toArray();

      return mutations.reduce(
        (counts, mutation) => {
          if (mutation.status === 'pending') {
            counts.pending += 1;
          }
          if (mutation.status === 'failed') {
            counts.failed += 1;
          }
          return counts;
        },
        { failed: 0, pending: 0 },
      );
    }, []) ?? { failed: 0, pending: 0 };

  const attemptSync = useEffectEvent(async () => {
    try {
      await runSupabaseSync();
    } catch {
      // Sync state is recorded in IndexedDB; keep the shell calm.
    }
  });

  const retrySync = async (): Promise<void> => {
    try {
      await runSupabaseSync();
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
  }, [auth.configured, auth.session, isOnline, mutationCounts.failed, mutationCounts.pending]);

  useEffect(() => {
    if (!auth.configured) {
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
        failedMutationCount: mutationCounts.failed,
        isOnline,
        pendingMutationCount: mutationCounts.pending,
        retrySync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
