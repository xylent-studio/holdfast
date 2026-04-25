import type { WorkspaceStateRecord } from '@/domain/schemas/records';

export function shouldShowSessionRecovery(
  workspaceState: WorkspaceStateRecord,
  hasSession: boolean,
): boolean {
  return !hasSession && workspaceState.ownershipState === 'member';
}
