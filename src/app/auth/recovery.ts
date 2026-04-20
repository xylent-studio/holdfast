import type { SyncStateRecord } from '@/domain/schemas/records';

export function shouldShowSessionRecovery(
  syncState: SyncStateRecord,
  hasSession: boolean,
): boolean {
  return (
    !hasSession &&
    syncState.identityState === 'member' &&
    syncState.authPromptState !== 'signed-out-by-user'
  );
}
