import { SCHEMA_VERSION, SYNC_STATE_ROW_ID } from '@/domain/constants';
import { nowIso } from '@/domain/dates';
import {
  SyncStateRecordSchema,
  type SyncStateRecord,
} from '@/domain/schemas/records';
import type { SyncBootstrapStatus } from '@/storage/sync/contracts';

export function createDefaultSyncState(
  status: SyncBootstrapStatus,
): SyncStateRecord {
  const timestamp = nowIso();

  return SyncStateRecordSchema.parse({
    id: SYNC_STATE_ROW_ID,
    schemaVersion: SCHEMA_VERSION,
    provider: 'supabase',
    mode: status.configured ? 'ready' : 'disabled',
    lastSyncedAt: null,
    authState: 'signed-out',
    identityState: 'device-guest',
    authPromptState: 'none',
    remoteUserId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function normalizeSyncStateRecord(record: unknown): SyncStateRecord {
  return SyncStateRecordSchema.parse(record);
}
