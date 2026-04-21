import type {
  SyncAuthPromptState,
  WorkspaceStateRecord,
} from '@/domain/schemas/records';

type AuthSyncPatch = Pick<
  WorkspaceStateRecord,
  'ownershipState' | 'boundUserId' | 'authPromptState' | 'attachState'
>;

export function hasAuthOwnerMismatch(
  current: WorkspaceStateRecord,
  nextRemoteUserId: string,
): boolean {
  return Boolean(
    current.ownershipState === 'member' &&
    current.boundUserId &&
    current.boundUserId !== nextRemoteUserId,
  );
}

export function signedInAuthPatch(nextRemoteUserId: string): AuthSyncPatch {
  return {
    ownershipState: 'member',
    boundUserId: nextRemoteUserId,
    authPromptState: 'none',
    attachState: 'attached',
  };
}

export function signedOutAuthPatch(
  current: WorkspaceStateRecord,
  promptState: SyncAuthPromptState,
): AuthSyncPatch {
  return {
    ownershipState:
      current.ownershipState === 'member' ? 'member' : 'device-guest',
    authPromptState:
      current.ownershipState === 'member' ? promptState : 'none',
    boundUserId:
      current.ownershipState === 'member' ? current.boundUserId : null,
    attachState: current.attachState,
  };
}

export function resolveSignedOutAuthPromptState(
  current: WorkspaceStateRecord,
  pendingPromptState: SyncAuthPromptState | null,
): SyncAuthPromptState {
  if (pendingPromptState) {
    return pendingPromptState;
  }

  if (current.ownershipState !== 'member') {
    return 'none';
  }

  return current.authPromptState === 'none'
    ? 'session-expired'
    : current.authPromptState;
}
