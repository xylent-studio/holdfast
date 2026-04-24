import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { deriveSyncHealth } from '@/domain/logic/sync';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

function makeSyncState() {
  return {
    id: 'sync',
    schemaVersion: SCHEMA_VERSION,
    provider: 'supabase' as const,
    mode: 'ready' as const,
    blockedReason: null,
    lastFailureAt: null,
    lastSyncedAt: '2026-04-24T10:00:00.000Z',
    lastTransportError: null,
    pullCursorByStream: createDefaultSyncPullCursorMap(),
    createdAt: '2026-04-24T09:00:00.000Z',
    updatedAt: '2026-04-24T10:00:00.000Z',
  };
}

function makeWorkspaceState() {
  return {
    id: 'workspace',
    schemaVersion: SCHEMA_VERSION,
    ownershipState: 'member' as const,
    boundUserId: '11111111-1111-4111-8111-111111111111',
    authPromptState: 'none' as const,
    attachState: 'attached' as const,
    createdAt: '2026-04-24T09:00:00.000Z',
    updatedAt: '2026-04-24T10:00:00.000Z',
  };
}

describe('deriveSyncHealth', () => {
  it('reports offline work as blocked but safe', () => {
    const result = deriveSyncHealth({
      configured: true,
      failedMutationCount: 0,
      hasConflictAttention: false,
      isOnline: false,
      pendingMutationCount: 1,
      signedIn: true,
      syncState: {
        ...makeSyncState(),
        blockedReason: 'offline',
      },
      workspaceState: makeWorkspaceState(),
    });

    expect(result).toMatchObject({
      blockedReason: 'offline',
      label: 'Saved offline',
      state: 'blocked',
    });
  });

  it('reports transport failures as degraded', () => {
    const result = deriveSyncHealth({
      configured: true,
      failedMutationCount: 0,
      hasConflictAttention: false,
      isOnline: true,
      pendingMutationCount: 0,
      signedIn: true,
      syncState: {
        ...makeSyncState(),
        lastTransportError: 'Remote pull failed.',
        mode: 'error',
      },
      workspaceState: makeWorkspaceState(),
    });

    expect(result).toMatchObject({
      label: "Couldn't sync yet",
      state: 'degraded',
    });
    expect(result.detail).toBe('Remote pull failed.');
  });

  it('reports queued signed-in work as syncing', () => {
    const result = deriveSyncHealth({
      configured: true,
      failedMutationCount: 0,
      hasConflictAttention: false,
      isOnline: true,
      pendingMutationCount: 2,
      signedIn: true,
      syncState: makeSyncState(),
      workspaceState: makeWorkspaceState(),
    });

    expect(result).toMatchObject({
      label: 'Syncing...',
      state: 'syncing',
    });
  });
});
