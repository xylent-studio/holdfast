import { z } from 'zod';

import {
  SCHEMA_VERSION,
  SETTINGS_ROW_ID,
  SYNC_STATE_ROW_ID,
  WORKSPACE_STATE_ROW_ID,
} from '@/domain/constants';
import { nowIso } from '@/domain/dates';
import {
  AttachmentBlobRecordSchema,
  AttachmentRecordSchema,
  DailyRecordSchema,
  ItemRecordSchema,
  ListItemRecordSchema,
  ListRecordSchema,
  MutationRecordSchema,
  RoutineRecordSchema,
  SettingsRecordSchema,
  SyncStateRecordSchema,
  type AttachmentRecord,
  type DailyRecord,
  type ItemRecord,
  type ListItemRecord,
  type ListRecord,
  type MutationRecord,
  type RoutineRecord,
  type SettingsRecord,
  WorkspaceStateRecordSchema,
  type WorkspaceBackupSummary as WorkspaceBackupSummaryRecord,
  WorkspaceRestoreSessionRecordSchema,
  WeeklyRecordSchema,
  type WeeklyRecord,
} from '@/domain/schemas/records';
import { getAttachmentDownload } from '@/storage/local/api';
import { db } from '@/storage/local/db';
import { createDefaultWorkspaceState } from '@/storage/local/workspace-state';
import { getSupabaseSyncStatus } from '@/storage/sync/supabase/config';
import { createDefaultSyncState } from '@/storage/sync/state';

type BackupRecord<T extends { syncState: unknown; remoteRevision: unknown }> = Omit<
  T,
  'remoteRevision' | 'syncState'
>;
type BackupItemRecord = BackupRecord<ItemRecord>;
type BackupListRecord = BackupRecord<ListRecord>;
type BackupListItemRecord = BackupRecord<ListItemRecord>;
type BackupDailyRecord = BackupRecord<DailyRecord>;
type BackupWeeklyRecord = BackupRecord<WeeklyRecord>;
type BackupRoutineRecord = BackupRecord<RoutineRecord>;
type BackupSettingsRecord = BackupRecord<SettingsRecord>;
type BackupAttachmentRecord = BackupRecord<AttachmentRecord>;

export interface WorkspaceBackupSummary {
  attachmentCount: number;
  attachmentPayloadMissingCount: number;
  dayCount: number;
  itemCount: number;
  listCount: number;
  listItemCount: number;
  routineCount: number;
  weekCount: number;
}

export interface WorkspaceBackupAttachment {
  dataUrl: string | null;
  payloadState: 'embedded' | 'missing';
  record: BackupAttachmentRecord;
}

export interface WorkspaceBackupFile {
  appSchemaVersion: typeof SCHEMA_VERSION;
  attachments: WorkspaceBackupAttachment[];
  dailyRecords: BackupDailyRecord[];
  exportedAt: string;
  format: 'holdfast-backup';
  items: BackupItemRecord[];
  listItems: BackupListItemRecord[];
  lists: BackupListRecord[];
  routines: BackupRoutineRecord[];
  settings: BackupSettingsRecord | null;
  summary: WorkspaceBackupSummary;
  version: 1;
  weeklyRecords: BackupWeeklyRecord[];
}

export interface WorkspaceBackupExport {
  backup: WorkspaceBackupFile;
  blob: Blob;
  filename: string;
}

export interface WorkspaceRestoreResult {
  restoredAt: string;
  sourceExportedAt: string;
  summary: WorkspaceBackupSummary;
}

export interface WorkspaceRestoreUndoAvailability {
  createdAt: string | null;
  mode: 'none' | 'recorded';
  summary: WorkspaceBackupSummary | null;
}

type AttachmentRestorePayloadState = 'embedded' | 'missing';

const BackupItemRecordSchema = ItemRecordSchema.omit({
  syncState: true,
  remoteRevision: true,
});
const BackupListRecordSchema = ListRecordSchema.omit({
  syncState: true,
  remoteRevision: true,
});
const BackupListItemRecordSchema = ListItemRecordSchema.omit({
  syncState: true,
  remoteRevision: true,
});
const BackupDailyRecordSchema = DailyRecordSchema.omit({
  syncState: true,
  remoteRevision: true,
});
const BackupWeeklyRecordSchema = WeeklyRecordSchema.omit({
  syncState: true,
  remoteRevision: true,
});
const BackupRoutineRecordSchema = RoutineRecordSchema.omit({
  syncState: true,
  remoteRevision: true,
});
const BackupSettingsRecordSchema = SettingsRecordSchema.omit({
  syncState: true,
  remoteRevision: true,
});
const BackupAttachmentRecordSchema = AttachmentRecordSchema.omit({
  syncState: true,
  remoteRevision: true,
});
const WorkspaceBackupSummarySchema = z.object({
  attachmentCount: z.number().int().nonnegative(),
  attachmentPayloadMissingCount: z.number().int().nonnegative(),
  dayCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  listCount: z.number().int().nonnegative(),
  listItemCount: z.number().int().nonnegative(),
  routineCount: z.number().int().nonnegative(),
  weekCount: z.number().int().nonnegative(),
});
const WorkspaceBackupAttachmentSchema = z.object({
  dataUrl: z.string().nullable(),
  payloadState: z.enum(['embedded', 'missing']),
  record: BackupAttachmentRecordSchema,
});
const WorkspaceBackupFileSchema: z.ZodType<WorkspaceBackupFile> = z.object({
  appSchemaVersion: z.number().int().positive(),
  attachments: z.array(WorkspaceBackupAttachmentSchema),
  dailyRecords: z.array(BackupDailyRecordSchema),
  exportedAt: z.string(),
  format: z.literal('holdfast-backup'),
  items: z.array(BackupItemRecordSchema),
  listItems: z.array(BackupListItemRecordSchema),
  lists: z.array(BackupListRecordSchema),
  routines: z.array(BackupRoutineRecordSchema),
  settings: BackupSettingsRecordSchema.nullable(),
  summary: WorkspaceBackupSummarySchema,
  version: z.literal(1),
  weeklyRecords: z.array(BackupWeeklyRecordSchema),
});

function compareByCreatedAt<T extends { createdAt: string; id: string }>(
  left: T,
  right: T,
): number {
  return (
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareByDate<T extends { date: string }>(left: T, right: T): number {
  return left.date.localeCompare(right.date);
}

function compareByWeekStart<T extends { weekStart: string }>(
  left: T,
  right: T,
): number {
  return left.weekStart.localeCompare(right.weekStart);
}

function compareListItems(left: ListItemRecord, right: ListItemRecord): number {
  return (
    left.listId.localeCompare(right.listId) ||
    left.position - right.position ||
    left.id.localeCompare(right.id)
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function blobToDataUrl(blob: Blob, mimeType: string): Promise<string> {
  const normalizedBlob =
    blob instanceof Blob
      ? blob
      : new Blob(
          [
            typeof (blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> })
              .arrayBuffer === 'function'
              ? await (blob as Blob & { arrayBuffer: () => Promise<ArrayBuffer> })
                  .arrayBuffer()
              : (blob as BlobPart),
          ],
          {
            type:
              mimeType ||
              (blob as Blob & { type?: string }).type ||
              'application/octet-stream',
          },
        );
  const bytes = new Uint8Array(
    typeof normalizedBlob.arrayBuffer === 'function'
      ? await normalizedBlob.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () =>
            reject(reader.error ?? new Error("Couldn't read the attachment."));
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.readAsArrayBuffer(normalizedBlob);
        }),
  );
  const type = mimeType || normalizedBlob.type || 'application/octet-stream';
  return `data:${type};base64,${bytesToBase64(bytes)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, payload = ''] = dataUrl.split(',');
  const mimeMatch = meta.match(/^data:([^;]+);/i);
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream';
  const decoded = atob(payload);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function buildBackupSummary(
  items: BackupItemRecord[],
  lists: BackupListRecord[],
  listItems: BackupListItemRecord[],
  dailyRecords: BackupDailyRecord[],
  weeklyRecords: BackupWeeklyRecord[],
  routines: BackupRoutineRecord[],
  attachments: WorkspaceBackupAttachment[],
): WorkspaceBackupSummary {
  return {
    attachmentCount: attachments.length,
    attachmentPayloadMissingCount: attachments.filter(
      (attachment) => attachment.payloadState === 'missing',
    ).length,
    dayCount: dailyRecords.length,
    itemCount: items.length,
    listCount: lists.length,
    listItemCount: listItems.length,
    routineCount: routines.length,
    weekCount: weeklyRecords.length,
  };
}

export function workspaceBackupFilename(exportedAt: string): string {
  return `holdfast-backup-${exportedAt.slice(0, 10)}.json`;
}

function stripSyncMetadata<T extends { remoteRevision: unknown; syncState: unknown }>(
  record: T,
): Omit<T, 'remoteRevision' | 'syncState'> {
  const { remoteRevision, syncState, ...rest } = record;
  void remoteRevision;
  void syncState;
  return rest;
}

function createRestoreMutationRecord(
  entity: MutationRecord['entity'],
  entityId: string,
  type: string,
  payload: Record<string, unknown>,
  createdAt: string,
): MutationRecord {
  return MutationRecordSchema.parse({
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    entity,
    entityId,
    type,
    payload,
    createdAt,
    status: 'pending',
    attempts: 0,
    lastError: null,
  });
}

function isDeletedMutation(mutation: MutationRecord): boolean {
  return mutation.type.endsWith('.deleted');
}

function mutationEntityKey(
  entity: MutationRecord['entity'],
  entityId: string,
): string {
  return `${entity}:${entityId}`;
}

function isEntityPresentInFinalState(
  entity: MutationRecord['entity'],
  entityId: string,
  finalState: {
    itemIds: Set<string>;
    listIds: Set<string>;
    listItemIds: Set<string>;
    routineIds: Set<string>;
    attachmentIds: Set<string>;
  },
): boolean {
  switch (entity) {
    case 'item':
      return finalState.itemIds.has(entityId);
    case 'list':
      return finalState.listIds.has(entityId);
    case 'listItem':
      return finalState.listItemIds.has(entityId);
    case 'routine':
      return finalState.routineIds.has(entityId);
    case 'attachment':
      return finalState.attachmentIds.has(entityId);
    case 'dailyRecord':
    case 'weeklyRecord':
    case 'settings':
      return false;
  }
}

function preserveQueuedDeletionMutation(mutation: MutationRecord): MutationRecord {
  return MutationRecordSchema.parse({
    ...mutation,
    status: 'pending',
    lastError: null,
  });
}

function normalizeImportedItem(
  record: BackupItemRecord,
  restoredAt: string,
): ItemRecord {
  return ItemRecordSchema.parse({
    ...record,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: restoredAt,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function normalizeImportedList(
  record: BackupListRecord,
  restoredAt: string,
): ListRecord {
  return ListRecordSchema.parse({
    ...record,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: restoredAt,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function normalizeImportedListItem(
  record: BackupListItemRecord,
  restoredAt: string,
): ListItemRecord {
  return ListItemRecordSchema.parse({
    ...record,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: restoredAt,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function normalizeImportedRoutine(
  record: BackupRoutineRecord,
  restoredAt: string,
): RoutineRecord {
  return RoutineRecordSchema.parse({
    ...record,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: restoredAt,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function normalizeImportedDailyRecord(
  record: BackupDailyRecord,
  updatedAt: string,
): DailyRecord {
  return DailyRecordSchema.parse({
    ...record,
    schemaVersion: SCHEMA_VERSION,
    updatedAt,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function normalizeImportedWeeklyRecord(
  record: BackupWeeklyRecord,
  updatedAt: string,
): WeeklyRecord {
  return WeeklyRecordSchema.parse({
    ...record,
    schemaVersion: SCHEMA_VERSION,
    updatedAt,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function normalizeImportedSettings(
  record: BackupSettingsRecord | null,
  restoredAt: string,
): SettingsRecord {
  return SettingsRecordSchema.parse({
    id: SETTINGS_ROW_ID,
    schemaVersion: SCHEMA_VERSION,
    direction: record?.direction ?? '',
    standards: record?.standards ?? '',
    why: record?.why ?? '',
    createdAt: record?.createdAt ?? restoredAt,
    updatedAt: restoredAt,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function mergeByDate(
  current: DailyRecord[],
  imported: DailyRecord[],
): DailyRecord[] {
  const merged = new Map(current.map((record) => [record.date, record]));
  for (const record of imported) {
    merged.set(record.date, record);
  }

  return [...merged.values()].sort(compareByDate);
}

function mergeByWeekStart(
  current: WeeklyRecord[],
  imported: WeeklyRecord[],
): WeeklyRecord[] {
  const merged = new Map(current.map((record) => [record.weekStart, record]));
  for (const record of imported) {
    merged.set(record.weekStart, record);
  }

  return [...merged.values()].sort(compareByWeekStart);
}

function parseWorkspaceBackupValue(value: unknown): WorkspaceBackupFile {
  const parsed = WorkspaceBackupFileSchema.parse(value);
  if (parsed.appSchemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `This backup was created by a newer Holdfast schema (${parsed.appSchemaVersion}). Update the app before restoring it.`,
    );
  }

  return parsed;
}

async function parseWorkspaceBackupFile(file: File): Promise<WorkspaceBackupFile> {
  const text = await file.text();

  try {
    return parseWorkspaceBackupValue(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("This backup file couldn't be read.", {
        cause: error,
      });
    }

    throw error;
  }
}

function latestOpenWorkspaceRestoreSession(
  rows: unknown[],
): z.infer<typeof WorkspaceRestoreSessionRecordSchema> | null {
  return rows
    .map((row) => WorkspaceRestoreSessionRecordSchema.parse(row))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .find((row) => !row.undoneAt) ?? null;
}

function toSummaryRecord(
  summary: WorkspaceBackupSummary,
): WorkspaceBackupSummaryRecord {
  return summary;
}

async function applyWorkspaceBackup(
  backup: WorkspaceBackupFile,
  options?: { attachUserId?: string | null; recordUndo?: boolean },
): Promise<WorkspaceRestoreResult> {
  const parsedBackup = parseWorkspaceBackupValue(backup);
  const attachUserId = options?.attachUserId ?? null;
  const recordUndo = options?.recordUndo ?? true;
  const restoredAt = nowIso();
  const previousBackup = recordUndo ? await createWorkspaceBackup() : null;

  const [
    currentItems,
    currentLists,
    currentListItems,
    currentDailyRecords,
    currentWeeklyRecords,
    currentRoutines,
    currentAttachments,
    currentMutations,
  ] = await Promise.all([
    db.items.toArray(),
    db.lists.toArray(),
    db.listItems.toArray(),
    db.dailyRecords.toArray(),
    db.weeklyRecords.toArray(),
    db.routines.toArray(),
    db.attachments.toArray(),
    db.mutationQueue.toArray(),
  ]);

  const finalItems = parsedBackup.items.map((record) =>
    normalizeImportedItem(record, restoredAt),
  );
  const finalItemIds = new Set(finalItems.map((record) => record.id));

  const finalLists = parsedBackup.lists.map((record) =>
    normalizeImportedList(record, restoredAt),
  );
  const finalListIds = new Set(finalLists.map((record) => record.id));

  const finalListItems = parsedBackup.listItems
    .filter((record) => finalListIds.has(record.listId))
    .map((record) => normalizeImportedListItem(record, restoredAt));
  const finalListItemIds = new Set(finalListItems.map((record) => record.id));

  const finalRoutines = parsedBackup.routines.map((record) =>
    normalizeImportedRoutine(record, restoredAt),
  );
  const finalRoutineIds = new Set(finalRoutines.map((record) => record.id));

  const finalAttachments: AttachmentRecord[] = [];
  const finalAttachmentBlobs = [];
  const attachmentPayloadStates = new Map<
    string,
    AttachmentRestorePayloadState
  >();

  for (const entry of parsedBackup.attachments) {
    if (!finalItemIds.has(entry.record.itemId)) {
      continue;
    }

    attachmentPayloadStates.set(entry.record.id, entry.payloadState);
    finalAttachments.push(
      AttachmentRecordSchema.parse({
        ...entry.record,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: restoredAt,
        syncState: 'pending',
      }),
    );

    if (entry.payloadState === 'embedded' && entry.dataUrl) {
      finalAttachmentBlobs.push(
        AttachmentBlobRecordSchema.parse({
          id: entry.record.blobId,
          schemaVersion: SCHEMA_VERSION,
          blob: dataUrlToBlob(entry.dataUrl),
          createdAt: restoredAt,
        }),
      );
    }
  }
  const finalAttachmentIds = new Set(finalAttachments.map((record) => record.id));
  const finalRestoreState = {
    itemIds: finalItemIds,
    listIds: finalListIds,
    listItemIds: finalListItemIds,
    routineIds: finalRoutineIds,
    attachmentIds: finalAttachmentIds,
  };

  const importedDailyRecords = parsedBackup.dailyRecords.map((record) =>
    normalizeImportedDailyRecord(record, restoredAt),
  );
  const importedDailyDates = new Set(importedDailyRecords.map((record) => record.date));
  const preservedDailyRecords = currentDailyRecords
    .filter((record) => !importedDailyDates.has(record.date))
    .map((record) =>
      DailyRecordSchema.parse({
        ...record,
        schemaVersion: SCHEMA_VERSION,
        syncState: 'pending',
        remoteRevision: null,
      }),
    );
  const finalDailyRecords = mergeByDate(
    preservedDailyRecords,
    importedDailyRecords,
  );

  const importedWeeklyRecords = parsedBackup.weeklyRecords.map((record) =>
    normalizeImportedWeeklyRecord(record, restoredAt),
  );
  const importedWeekStarts = new Set(
    importedWeeklyRecords.map((record) => record.weekStart),
  );
  const preservedWeeklyRecords = currentWeeklyRecords
    .filter((record) => !importedWeekStarts.has(record.weekStart))
    .map((record) =>
      WeeklyRecordSchema.parse({
        ...record,
        schemaVersion: SCHEMA_VERSION,
        syncState: 'pending',
        remoteRevision: null,
      }),
    );
  const finalWeeklyRecords = mergeByWeekStart(
    preservedWeeklyRecords,
    importedWeeklyRecords,
  );

  const finalSettings = normalizeImportedSettings(parsedBackup.settings, restoredAt);

  const currentItemIds = new Set(
    currentItems.filter((record) => !record.deletedAt).map((record) => record.id),
  );
  const currentListIds = new Set(
    currentLists.filter((record) => !record.deletedAt).map((record) => record.id),
  );
  const currentListItemIds = new Set(
    currentListItems
      .filter((record) => !record.deletedAt)
      .map((record) => record.id),
  );
  const currentRoutineIds = new Set(
    currentRoutines.filter((record) => !record.deletedAt).map((record) => record.id),
  );
  const currentAttachmentIds = new Set(
    currentAttachments
      .filter((record) => !record.deletedAt)
      .map((record) => record.id),
  );

  const preservedDeletionMutations = currentMutations
    .filter(
      (mutation) =>
        mutation.status !== 'acknowledged' &&
        isDeletedMutation(mutation) &&
        !isEntityPresentInFinalState(
          mutation.entity,
          mutation.entityId,
          finalRestoreState,
        ),
    )
    .map(preserveQueuedDeletionMutation);
  const preservedDeletionKeys = new Set(
    preservedDeletionMutations.map((mutation) =>
      mutationEntityKey(mutation.entity, mutation.entityId),
    ),
  );

  const mutations: MutationRecord[] = [...preservedDeletionMutations];

  for (const itemId of currentItemIds) {
    if (
      !finalItemIds.has(itemId) &&
      !preservedDeletionKeys.has(mutationEntityKey('item', itemId))
    ) {
      mutations.push(
        createRestoreMutationRecord('item', itemId, 'item.deleted', { itemId }, restoredAt),
      );
    }
  }

  for (const listId of currentListIds) {
    if (
      !finalListIds.has(listId) &&
      !preservedDeletionKeys.has(mutationEntityKey('list', listId))
    ) {
      mutations.push(
        createRestoreMutationRecord('list', listId, 'list.deleted', { listId }, restoredAt),
      );
    }
  }

  for (const listItemId of currentListItemIds) {
    if (
      !finalListItemIds.has(listItemId) &&
      !preservedDeletionKeys.has(mutationEntityKey('listItem', listItemId))
    ) {
      mutations.push(
        createRestoreMutationRecord(
          'listItem',
          listItemId,
          'list-item.deleted',
          { listItemId },
          restoredAt,
        ),
      );
    }
  }

  for (const routineId of currentRoutineIds) {
    if (
      !finalRoutineIds.has(routineId) &&
      !preservedDeletionKeys.has(mutationEntityKey('routine', routineId))
    ) {
      mutations.push(
        createRestoreMutationRecord(
          'routine',
          routineId,
          'routine.deleted',
          { routineId },
          restoredAt,
        ),
      );
    }
  }

  for (const attachmentId of currentAttachmentIds) {
    if (
      !finalAttachmentIds.has(attachmentId) &&
      !preservedDeletionKeys.has(mutationEntityKey('attachment', attachmentId))
    ) {
      mutations.push(
        createRestoreMutationRecord(
          'attachment',
          attachmentId,
          'attachment.deleted',
          { attachmentId },
          restoredAt,
        ),
      );
    }
  }

  for (const record of finalItems) {
    mutations.push(
      createRestoreMutationRecord('item', record.id, 'item.restored', { item: record }, restoredAt),
    );
  }
  for (const record of finalLists) {
    mutations.push(
      createRestoreMutationRecord('list', record.id, 'list.restored', { list: record }, restoredAt),
    );
  }
  for (const record of finalListItems) {
    mutations.push(
      createRestoreMutationRecord(
        'listItem',
        record.id,
        'list-item.restored',
        { listItem: record },
        restoredAt,
      ),
    );
  }
  for (const record of finalDailyRecords) {
    mutations.push(
      createRestoreMutationRecord(
        'dailyRecord',
        record.date,
        'daily.restored',
        { dailyRecord: record },
        restoredAt,
      ),
    );
  }
  for (const record of finalWeeklyRecords) {
    mutations.push(
      createRestoreMutationRecord(
        'weeklyRecord',
        record.weekStart,
        'weekly.restored',
        { weeklyRecord: record },
        restoredAt,
      ),
    );
  }
  for (const record of finalRoutines) {
    mutations.push(
      createRestoreMutationRecord(
        'routine',
        record.id,
        'routine.restored',
        { routine: record },
        restoredAt,
      ),
    );
  }
  mutations.push(
    createRestoreMutationRecord(
      'settings',
      SETTINGS_ROW_ID,
      'settings.restored',
      { settings: finalSettings },
      restoredAt,
    ),
  );
  for (const record of finalAttachments) {
    mutations.push(
      createRestoreMutationRecord(
        'attachment',
        record.id,
        'attachment.restored',
        {
          attachment: record,
          payloadState: attachmentPayloadStates.get(record.id) ?? 'embedded',
        },
        restoredAt,
      ),
    );
  }

  await db.transaction(
    'rw',
    [
      db.items,
      db.lists,
      db.listItems,
      db.dailyRecords,
      db.weeklyRecords,
      db.routines,
      db.settings,
      db.attachments,
      db.attachmentBlobs,
      db.mutationQueue,
      db.workspaceRestoreSessions,
      db.syncState,
      db.workspaceState,
    ],
    async () => {
      await db.items.clear();
      await db.lists.clear();
      await db.listItems.clear();
      await db.dailyRecords.clear();
      await db.weeklyRecords.clear();
      await db.routines.clear();
      await db.settings.clear();
      await db.attachments.clear();
      await db.attachmentBlobs.clear();
      await db.mutationQueue.clear();
      await db.syncState.clear();
      await db.workspaceState.clear();

      if (recordUndo && previousBackup) {
        await db.workspaceRestoreSessions.clear();
        await db.workspaceRestoreSessions.put(
          WorkspaceRestoreSessionRecordSchema.parse({
            id: crypto.randomUUID(),
            schemaVersion: SCHEMA_VERSION,
            createdAt: restoredAt,
            undoneAt: null,
            restoredSummary: toSummaryRecord(parsedBackup.summary),
            previousBackupJson: JSON.stringify(previousBackup),
          }),
        );
      }

      await db.syncState.put(
        SyncStateRecordSchema.parse({
          ...createDefaultSyncState(getSupabaseSyncStatus()),
          id: SYNC_STATE_ROW_ID,
          schemaVersion: SCHEMA_VERSION,
          lastSyncedAt: null,
          updatedAt: restoredAt,
        }),
      );
      await db.workspaceState.put(
        WorkspaceStateRecordSchema.parse({
          ...createDefaultWorkspaceState(),
          authPromptState: 'none',
          attachState: attachUserId ? 'attached' : 'detached-restore',
          boundUserId: attachUserId,
          createdAt: restoredAt,
          id: WORKSPACE_STATE_ROW_ID,
          ownershipState: attachUserId ? 'member' : 'device-guest',
          schemaVersion: SCHEMA_VERSION,
          updatedAt: restoredAt,
        }),
      );

      if (finalItems.length) {
        await db.items.bulkPut(finalItems);
      }
      if (finalLists.length) {
        await db.lists.bulkPut(finalLists);
      }
      if (finalListItems.length) {
        await db.listItems.bulkPut(finalListItems);
      }
      if (finalDailyRecords.length) {
        await db.dailyRecords.bulkPut(finalDailyRecords);
      }
      if (finalWeeklyRecords.length) {
        await db.weeklyRecords.bulkPut(finalWeeklyRecords);
      }
      if (finalRoutines.length) {
        await db.routines.bulkPut(finalRoutines);
      }
      await db.settings.put(finalSettings);
      if (finalAttachments.length) {
        await db.attachments.bulkPut(finalAttachments);
      }
      if (finalAttachmentBlobs.length) {
        await db.attachmentBlobs.bulkPut(finalAttachmentBlobs);
      }
      if (mutations.length) {
        await db.mutationQueue.bulkPut(mutations);
      }
    },
  );

  return {
    restoredAt,
    sourceExportedAt: parsedBackup.exportedAt,
    summary: parsedBackup.summary,
  };
}

export async function createWorkspaceBackup(): Promise<WorkspaceBackupFile> {
  const [
    itemRows,
    listRows,
    listItemRows,
    dailyRecords,
    weeklyRecords,
    routineRows,
    settings,
    attachmentRows,
  ] = await Promise.all([
    db.items.toArray(),
    db.lists.toArray(),
    db.listItems.toArray(),
    db.dailyRecords.toArray(),
    db.weeklyRecords.toArray(),
    db.routines.toArray(),
    db.settings.get(SETTINGS_ROW_ID),
    db.attachments.toArray(),
  ]);

  const items = itemRows
    .filter((item) => !item.deletedAt)
    .sort(compareByCreatedAt)
    .map(stripSyncMetadata);
  const lists = listRows
    .filter((list) => !list.deletedAt)
    .sort(compareByCreatedAt)
    .map(stripSyncMetadata);
  const activeItemIds = new Set(items.map((item) => item.id));
  const activeListIds = new Set(lists.map((list) => list.id));
  const listItems = listItemRows
    .filter(
      (listItem) => !listItem.deletedAt && activeListIds.has(listItem.listId),
    )
    .sort(compareListItems)
    .map(stripSyncMetadata);
  const routines = routineRows
    .filter((routine) => !routine.deletedAt)
    .sort(compareByCreatedAt)
    .map(stripSyncMetadata);
  const activeAttachments = attachmentRows
    .filter(
      (attachment) =>
        !attachment.deletedAt && activeItemIds.has(attachment.itemId),
    )
    .sort(compareByCreatedAt);

  const attachments: WorkspaceBackupAttachment[] = [];
  for (const attachment of activeAttachments) {
    const payload = await getAttachmentDownload(attachment.id);

    attachments.push({
      dataUrl: payload
        ? await blobToDataUrl(payload.blob, attachment.mimeType)
        : null,
      payloadState: payload ? 'embedded' : 'missing',
      record: stripSyncMetadata(attachment),
    });
  }

  const sortedDailyRecords = dailyRecords
    .sort(compareByDate)
    .map(stripSyncMetadata);
  const sortedWeeklyRecords = weeklyRecords
    .sort(compareByWeekStart)
    .map(stripSyncMetadata);
  const exportedAt = new Date().toISOString();

  return {
    appSchemaVersion: SCHEMA_VERSION,
    attachments,
    dailyRecords: sortedDailyRecords,
    exportedAt,
    format: 'holdfast-backup',
    items,
    listItems,
    lists,
    routines,
    settings: settings ? stripSyncMetadata(settings) : null,
    summary: buildBackupSummary(
      items,
      lists,
      listItems,
      sortedDailyRecords,
      sortedWeeklyRecords,
      routines,
      attachments,
    ),
    version: 1,
    weeklyRecords: sortedWeeklyRecords,
  };
}

export async function createWorkspaceBackupExport(): Promise<WorkspaceBackupExport> {
  const backup = await createWorkspaceBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });

  return {
    backup,
    blob,
    filename: workspaceBackupFilename(backup.exportedAt),
  };
}

export async function previewWorkspaceBackupFile(
  file: File,
): Promise<Pick<WorkspaceBackupFile, 'exportedAt' | 'summary'>> {
  const backup = await parseWorkspaceBackupFile(file);
  return {
    exportedAt: backup.exportedAt,
    summary: backup.summary,
  };
}

export async function importWorkspaceBackupFile(
  file: File,
  options?: { attachUserId?: string | null },
): Promise<WorkspaceRestoreResult> {
  const backup = await parseWorkspaceBackupFile(file);
  return applyWorkspaceBackup(backup, options);
}

export async function getWorkspaceRestoreUndoAvailability(): Promise<WorkspaceRestoreUndoAvailability> {
  const sessions = await db.workspaceRestoreSessions.toArray();
  const latest = latestOpenWorkspaceRestoreSession(sessions);

  return latest
    ? {
        createdAt: latest.createdAt,
        mode: 'recorded',
        summary: latest.restoredSummary,
      }
    : {
        createdAt: null,
        mode: 'none',
        summary: null,
      };
}

export async function undoLastWorkspaceRestore(
  options?: { attachUserId?: string | null },
): Promise<WorkspaceRestoreResult> {
  const sessions = await db.workspaceRestoreSessions.toArray();
  const latest = latestOpenWorkspaceRestoreSession(sessions);

  if (!latest) {
    throw new Error('No workspace restore with undo history was found yet.');
  }

  const previousBackup = parseWorkspaceBackupValue(
    JSON.parse(latest.previousBackupJson),
  );
  const result = await applyWorkspaceBackup(previousBackup, {
    attachUserId: options?.attachUserId ?? null,
    recordUndo: false,
  });

  await db.workspaceRestoreSessions.put(
    WorkspaceRestoreSessionRecordSchema.parse({
      ...latest,
      undoneAt: nowIso(),
    }),
  );

  return result;
}
