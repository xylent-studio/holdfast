import { createContext } from 'react';

export interface SyncContextValue {
  failedMutationCount: number;
  isOnline: boolean;
  pendingMutationCount: number;
  retrySync: () => Promise<void>;
}

export const SyncContext = createContext<SyncContextValue | null>(null);
