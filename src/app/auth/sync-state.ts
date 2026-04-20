import type {
  SyncAuthPromptState,
  SyncStateRecord,
} from '@/domain/schemas/records';

type AuthSyncPatch = Pick<
  SyncStateRecord,
  'authState' | 'identityState' | 'authPromptState' | 'remoteUserId'
>;

export function hasAuthOwnerMismatch(
  current: SyncStateRecord,
  nextRemoteUserId: string,
): boolean {
  return Boolean(
    current.identityState === 'member' &&
    current.remoteUserId &&
    current.remoteUserId !== nextRemoteUserId,
  );
}

export function signedInAuthPatch(nextRemoteUserId: string): AuthSyncPatch {
  return {
    authState: 'signed-in',
    identityState: 'member',
    authPromptState: 'none',
    remoteUserId: nextRemoteUserId,
  };
}

export function signedOutAuthPatch(
  current: SyncStateRecord,
  promptState: SyncAuthPromptState,
): AuthSyncPatch {
  return {
    authState: 'signed-out',
    identityState:
      current.identityState === 'member' ? 'member' : 'device-guest',
    authPromptState: current.identityState === 'member' ? promptState : 'none',
    remoteUserId:
      current.identityState === 'member' ? current.remoteUserId : null,
  };
}
