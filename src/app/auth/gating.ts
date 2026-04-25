import type { WorkspaceStateRecord } from '@/domain/schemas/records';

export type ShellAccessMode =
  | 'guest-shell'
  | 'member-recovery'
  | 'wrong-account-recovery'
  | 'explicit-auth-screen';

interface ShellAccessInput {
  authConfigured: boolean;
  authReady: boolean;
  hasSession: boolean;
  path: string;
  snapshotReady: boolean;
  workspaceState: WorkspaceStateRecord | null;
}

export function shouldWaitForShellAccess({
  authConfigured,
  authReady,
  snapshotReady,
  workspaceState,
}: Pick<
  ShellAccessInput,
  'authConfigured' | 'authReady' | 'snapshotReady' | 'workspaceState'
>): boolean {
  return (
    snapshotReady &&
    authConfigured &&
    !authReady &&
    workspaceState?.ownershipState === 'member'
  );
}

export function resolveShellAccessMode({
  authConfigured,
  authReady,
  hasSession,
  path,
  snapshotReady,
  workspaceState,
}: ShellAccessInput): ShellAccessMode {
  if (path === '/auth/callback') {
    return 'explicit-auth-screen';
  }

  if (!snapshotReady || !workspaceState || !authConfigured || hasSession) {
    return 'guest-shell';
  }

  if (!authReady) {
    return workspaceState.ownershipState === 'member'
      ? 'member-recovery'
      : 'guest-shell';
  }

  if (workspaceState.authPromptState === 'account-mismatch') {
    return 'wrong-account-recovery';
  }

  if (workspaceState.ownershipState === 'member') {
    return 'member-recovery';
  }

  return 'guest-shell';
}
