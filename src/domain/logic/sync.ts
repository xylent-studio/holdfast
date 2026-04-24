import type {
  SyncBlockedReason,
  SyncStateRecord,
  WorkspaceStateRecord,
} from '@/domain/schemas/records';

export type SyncHealthState = 'blocked' | 'syncing' | 'degraded' | 'healthy';

export interface SyncHealth {
  detail: string;
  failedMutationCount: number;
  label: string;
  pendingMutationCount: number;
  blockedReason: SyncBlockedReason | null;
  state: SyncHealthState;
}

function blockedReasonDetail(
  reason: SyncBlockedReason,
  workspaceState: WorkspaceStateRecord,
): string {
  switch (reason) {
    case 'not-configured':
      return 'This build is missing account setup.';
    case 'signed-out':
      return workspaceState.ownershipState === 'member'
        ? 'Sign in again to keep this device in sync.'
        : 'Sign in to sync this device.';
    case 'offline':
      return 'Local work is safe here and will catch up when this device reconnects.';
    case 'detached-restore':
      return 'Sign in to attach this restored workspace and start syncing it.';
    case 'account-mismatch':
      return "This device is still holding another account's workspace.";
  }
}

export function deriveSyncHealth({
  configured,
  failedMutationCount,
  hasConflictAttention,
  isOnline,
  pendingMutationCount,
  signedIn,
  syncState,
  workspaceState,
}: {
  configured: boolean;
  failedMutationCount: number;
  hasConflictAttention: boolean;
  isOnline: boolean;
  pendingMutationCount: number;
  signedIn: boolean;
  syncState: SyncStateRecord;
  workspaceState: WorkspaceStateRecord;
}): SyncHealth {
  const blockedReason =
    !configured
      ? 'not-configured'
      : syncState.blockedReason;

  if (hasConflictAttention) {
    return {
      detail: 'A few records need review before this device can be trusted again.',
      failedMutationCount,
      label: 'Needs attention',
      pendingMutationCount,
      blockedReason,
      state: 'degraded',
    };
  }

  if (blockedReason === 'offline') {
    return {
      detail: blockedReasonDetail(blockedReason, workspaceState),
      failedMutationCount,
      label: 'Saved offline',
      pendingMutationCount,
      blockedReason,
      state: 'blocked',
    };
  }

  if (blockedReason) {
    return {
      detail: blockedReasonDetail(blockedReason, workspaceState),
      failedMutationCount,
      label: "Can't sync yet",
      pendingMutationCount,
      blockedReason,
      state: 'blocked',
    };
  }

  if (syncState.mode === 'syncing' || (signedIn && pendingMutationCount > 0)) {
    return {
      detail: 'This device is catching up quietly in the background.',
      failedMutationCount,
      label: 'Syncing...',
      pendingMutationCount,
      blockedReason,
      state: 'syncing',
    };
  }

  if (syncState.mode === 'error' || failedMutationCount > 0) {
    return {
      detail:
        syncState.lastTransportError ??
        `There ${
          failedMutationCount === 1 ? 'is' : 'are'
        } ${failedMutationCount} change${
          failedMutationCount === 1 ? '' : 's'
        } still waiting for a clean retry.`,
      failedMutationCount,
      label: "Couldn't sync yet",
      pendingMutationCount,
      blockedReason,
      state: 'degraded',
    };
  }

  if (!signedIn || !isOnline || !syncState.lastSyncedAt) {
    return {
      detail: 'This device will show up to date once the first healthy sync finishes.',
      failedMutationCount,
      label: 'Syncing...',
      pendingMutationCount,
      blockedReason,
      state: 'syncing',
    };
  }

  return {
    detail: 'This device is caught up.',
    failedMutationCount,
    label: 'Up to date',
    pendingMutationCount,
    blockedReason,
    state: 'healthy',
  };
}
