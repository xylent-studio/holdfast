import { createContext } from 'react';

export interface SyncContextValue {
  isOnline: boolean;
  pendingMutationCount: number;
  retrySync: () => Promise<void>;
}

export const SyncContext = createContext<SyncContextValue | null>(null);
