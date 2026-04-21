import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import {
  createDefaultWorkspaceState,
  normalizeWorkspaceStateRecord,
} from '@/storage/local/workspace-state';
import {
  createDefaultSyncState,
  createDefaultSyncPullCursorMap,
  normalizeSyncStateRecord,
} from '@/storage/sync/state';

describe('createDefaultSyncState', () => {
  it('creates a transport-only sync state by default', () => {
    const result = createDefaultSyncState({
      configured: false,
      reason: 'Missing env vars.',
    });

    expect(result.mode).toBe('disabled');
    expect(result.lastSyncedAt).toBeNull();
    expect(result.provider).toBe('supabase');
    expect(result.pullCursorByStream).toEqual(createDefaultSyncPullCursorMap());
  });
});

describe('normalizeSyncStateRecord', () => {
  it('normalizes legacy sync rows without auth ownership fields', () => {
    const result = normalizeSyncStateRecord({
      id: 'sync',
      schemaVersion: SCHEMA_VERSION,
      provider: 'supabase',
      mode: 'ready',
      lastSyncedAt: null,
      pullCursorByStream: {
        items: { updatedAt: '2026-04-18T08:00:00.000Z', id: 'item-1' },
      },
      authState: 'signed-out',
      identityState: 'device-guest',
      authPromptState: 'none',
      remoteUserId: null,
      createdAt: '2026-04-18T08:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
    });

    expect(result).toMatchObject({
      id: 'sync',
      schemaVersion: SCHEMA_VERSION,
      provider: 'supabase',
      mode: 'ready',
      lastSyncedAt: null,
      pullCursorByStream: {
        ...createDefaultSyncPullCursorMap(),
        items: { updatedAt: '2026-04-18T08:00:00.000Z', id: 'item-1' },
      },
    });
  });
});

describe('workspace state helpers', () => {
  it('creates a detached-safe guest workspace by default', () => {
    const result = createDefaultWorkspaceState();

    expect(result.ownershipState).toBe('device-guest');
    expect(result.boundUserId).toBeNull();
    expect(result.authPromptState).toBe('none');
    expect(result.attachState).toBe('attached');
  });

  it('fills in safe defaults for legacy workspace rows', () => {
    const result = normalizeWorkspaceStateRecord({
      id: 'workspace',
      schemaVersion: SCHEMA_VERSION,
      ownershipState: 'member',
      boundUserId: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-04-18T08:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
    });

    expect(result).toMatchObject({
      ownershipState: 'member',
      boundUserId: '11111111-1111-4111-8111-111111111111',
      authPromptState: 'none',
      attachState: 'attached',
    });
  });
});
