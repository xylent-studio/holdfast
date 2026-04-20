import { useContext } from 'react';

import { SyncContext, type SyncContextValue } from '@/app/sync/context';

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error('useSync must be used inside SyncProvider.');
  }

  return context;
}
