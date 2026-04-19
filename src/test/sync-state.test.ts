import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import {
  createDefaultSyncState,
  normalizeSyncStateRecord,
} from '@/storage/sync/state';

describe('createDefaultSyncState', () => {
  it('creates a device guest workspace by default', () => {
    const result = createDefaultSyncState({
      configured: false,
      reason: 'Missing env vars.',
    });

    expect(result.mode).toBe('disabled');
    expect(result.authState).toBe('signed-out');
    expect(result.identityState).toBe('device-guest');
    expect(result.remoteUserId).toBeNull();
  });
});

describe('normalizeSyncStateRecord', () => {
  it('fills in guest fields for legacy sync rows', () => {
    const result = normalizeSyncStateRecord({
      id: 'sync',
      schemaVersion: SCHEMA_VERSION,
      provider: 'supabase',
      mode: 'ready',
      lastSyncedAt: null,
      authState: 'signed-out',
      createdAt: '2026-04-18T08:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
    });

    expect(result.identityState).toBe('device-guest');
    expect(result.remoteUserId).toBeNull();
  });
});
