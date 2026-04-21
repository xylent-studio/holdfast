import { SCHEMA_VERSION, SYNC_STATE_ROW_ID } from '@/domain/constants';
import { nowIso } from '@/domain/dates';
import {
  SyncStateRecordSchema,
  type SyncPullCursorMap,
  type SyncStateRecord,
} from '@/domain/schemas/records';
import type { SyncBootstrapStatus } from '@/storage/sync/contracts';

export function createDefaultSyncPullCursorMap(): SyncPullCursorMap {
  return {
    items: { updatedAt: null, id: null },
    lists: { updatedAt: null, id: null },
    listItems: { updatedAt: null, id: null },
    dailyRecords: { updatedAt: null, id: null },
    weeklyRecords: { updatedAt: null, id: null },
    routines: { updatedAt: null, id: null },
    settings: { updatedAt: null, id: null },
    attachments: { updatedAt: null, id: null },
    deletedRecords: { updatedAt: null, id: null },
  };
}

function normalizeSyncPullCursorMap(
  value: unknown,
): SyncPullCursorMap {
  const current =
    value && typeof value === 'object'
      ? (value as Partial<SyncPullCursorMap>)
      : {};
  const defaults = createDefaultSyncPullCursorMap();

  return {
    items: { ...defaults.items, ...(current.items ?? {}) },
    lists: { ...defaults.lists, ...(current.lists ?? {}) },
    listItems: { ...defaults.listItems, ...(current.listItems ?? {}) },
    dailyRecords: { ...defaults.dailyRecords, ...(current.dailyRecords ?? {}) },
    weeklyRecords: { ...defaults.weeklyRecords, ...(current.weeklyRecords ?? {}) },
    routines: { ...defaults.routines, ...(current.routines ?? {}) },
    settings: { ...defaults.settings, ...(current.settings ?? {}) },
    attachments: { ...defaults.attachments, ...(current.attachments ?? {}) },
    deletedRecords: {
      ...defaults.deletedRecords,
      ...(current.deletedRecords ?? {}),
    },
  };
}

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
    pullCursorByStream: createDefaultSyncPullCursorMap(),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function normalizeSyncStateRecord(record: unknown): SyncStateRecord {
  if (!record || typeof record !== 'object') {
    return SyncStateRecordSchema.parse(record);
  }

  return SyncStateRecordSchema.parse({
    ...record,
    pullCursorByStream: normalizeSyncPullCursorMap(
      (record as { pullCursorByStream?: unknown }).pullCursorByStream,
    ),
  });
}
