import { useLiveQuery } from 'dexie-react-hooks';

import {
  READINESS_CHECKS,
  SCHEMA_VERSION,
  SETTINGS_ROW_ID,
  SYNC_STATE_ROW_ID,
  WORKSPACE_STATE_ROW_ID,
} from '@/domain/constants';
import { addDays, nowIso, startOfWeek } from '@/domain/dates';
import type { DateKey } from '@/domain/dates';
import { buildCarryForwardTasks } from '@/domain/logic/close-day';
import {
  AttachmentBlobRecordSchema,
  AttachmentRecordSchema,
  ListItemRecordSchema,
  ListRecordSchema,
  DailyRecordSchema,
  ItemRecordSchema,
  MutationRecordSchema,
  RoutineRecordSchema,
  SettingsRecordSchema,
  SyncStateRecordSchema,
  WorkspaceStateRecordSchema,
  WeeklyRecordSchema,
  type AttachmentKind,
  type AttachmentRecord,
  type CaptureMode,
  type DailyRecord,
  type ItemKind,
  type ItemRecord,
  type ItemStatus,
  type ListItemRecord,
  type ListKind,
  type ListRecord,
  type MutationRecord,
  type ReadinessKey,
  type RoutineRecord,
  type SettingsRecord,
  type SyncStateRecord,
  type WorkspaceStateRecord,
  type WeeklyRecord,
} from '@/domain/schemas/records';
import { db } from '@/storage/local/db';
import {
  createDefaultWorkspaceState,
  normalizeWorkspaceStateRecord,
} from '@/storage/local/workspace-state';
import { downloadAttachmentBlob } from '@/storage/sync/supabase/attachments';
import { getSupabaseBrowserClient } from '@/storage/sync/supabase/client';
import { getSupabaseSyncStatus } from '@/storage/sync/supabase/config';
import {
  fromRemoteItemRow,
  fromRemoteListItemRow,
  fromRemoteListRow,
  type RemoteItemRow,
  type RemoteListItemRow,
  type RemoteListRow,
} from '@/storage/sync/supabase/schema';
import {
  createDefaultSyncPullCursorMap,
  createDefaultSyncState,
  normalizeSyncStateRecord,
} from '@/storage/sync/state';

export interface ItemWithAttachments extends ItemRecord {
  attachments: AttachmentRecord[];
}

export interface HoldfastSnapshot {
  currentDate: DateKey;
  items: ItemWithAttachments[];
  lists: ListRecord[];
  listItems: ListItemRecord[];
  dailyRecords: DailyRecord[];
  weeklyRecord: WeeklyRecord;
  currentDay: DailyRecord;
  settings: SettingsRecord;
  routines: RoutineRecord[];
  syncState: SyncStateRecord;
  workspaceState: WorkspaceStateRecord;
}

export interface CreateItemInput {
  title: string;
  kind: ItemKind;
  lane: ItemRecord['lane'];
  status: ItemStatus;
  body?: string;
  sourceText?: string | null;
  sourceItemId?: string | null;
  captureMode?: CaptureMode | null;
  sourceDate: DateKey;
  scheduledDate: DateKey | null;
  scheduledTime: string | null;
}

export interface CreateListInput {
  title: string;
  kind: ListKind;
  lane: ListRecord['lane'];
  pinned?: boolean;
  sourceItemId?: string | null;
}

export interface CreateListItemInput {
  listId: string;
  title: string;
  body?: string;
  position?: number;
  sourceItemId?: string | null;
}

export interface UpdateListInput {
  title?: string;
  kind?: ListKind;
  lane?: ListRecord['lane'];
  pinned?: boolean;
  archivedAt?: string | null;
}

export interface UpdateListItemInput {
  title?: string;
  body?: string;
  status?: ListItemRecord['status'];
  position?: number;
  sourceItemId?: string | null;
  promotedItemId?: string | null;
}

export interface ItemDraftPatch {
  title: string;
  kind: ItemKind;
  lane: ItemRecord['lane'];
  status: ItemStatus;
  body: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
}

export interface CloseDayInput {
  closeWin: string;
  closeCarry: string;
  closeSeed: string;
  closeNote: string;
}

function defaultDailyRecord(date: string): DailyRecord {
  const timestamp = nowIso();
  return DailyRecordSchema.parse({
    date,
    schemaVersion: SCHEMA_VERSION,
    startedAt: null,
    closedAt: null,
    readiness: Object.fromEntries(
      READINESS_CHECKS.map((check) => [check.key, false]),
    ),
    focusItemIds: [],
    launchNote: '',
    closeWin: '',
    closeCarry: '',
    closeSeed: '',
    closeNote: '',
    seededRoutineIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function defaultWeeklyRecord(weekStart: string): WeeklyRecord {
  const timestamp = nowIso();
  return WeeklyRecordSchema.parse({
    weekStart,
    schemaVersion: SCHEMA_VERSION,
    focus: '',
    protect: '',
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function defaultSettings(): SettingsRecord {
  const timestamp = nowIso();
  return SettingsRecordSchema.parse({
    id: SETTINGS_ROW_ID,
    schemaVersion: SCHEMA_VERSION,
    direction: '',
    standards: '',
    why: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function createMutationRecord(
  entity: MutationRecord['entity'],
  entityId: string,
  type: string,
  payload: Record<string, unknown>,
): MutationRecord {
  return MutationRecordSchema.parse({
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    entity,
    entityId,
    type,
    payload,
    createdAt: nowIso(),
    status: 'pending',
    attempts: 0,
    lastError: null,
  });
}

function createItemRecord(input: CreateItemInput): ItemRecord {
  const timestamp = nowIso();
  return ItemRecordSchema.parse({
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    title: input.title.trim(),
    kind: input.kind,
    lane: input.lane,
    status: input.status,
    body: input.body ?? '',
    sourceText: input.sourceText ?? null,
    sourceItemId: input.sourceItemId ?? null,
    captureMode: input.captureMode ?? null,
    sourceDate: input.sourceDate,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    routineId: null,
    completedAt: null,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function createListRecord(input: CreateListInput): ListRecord {
  const timestamp = nowIso();
  return ListRecordSchema.parse({
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    title: input.title.trim(),
    kind: input.kind,
    lane: input.lane,
    pinned: input.pinned ?? false,
    sourceItemId: input.sourceItemId ?? null,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function createListItemRecord(
  input: CreateListItemInput,
  position: number,
): ListItemRecord {
  const timestamp = nowIso();
  return ListItemRecordSchema.parse({
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    listId: input.listId,
    title: input.title.trim(),
    body: input.body ?? '',
    status: 'open',
    position,
    sourceItemId: input.sourceItemId ?? null,
    promotedItemId: null,
    completedAt: null,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    syncState: 'pending',
    remoteRevision: null,
  });
}

function attachmentKindForFile(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) {
    return 'image';
  }
  if (file.type.startsWith('audio/')) {
    return 'audio';
  }
  return 'file';
}

async function ensureSettingsAndSync(): Promise<{
  settings: SettingsRecord;
  syncState: SyncStateRecord;
  workspaceState: WorkspaceStateRecord;
}> {
  let settings = await db.settings.get(SETTINGS_ROW_ID);
  if (!settings) {
    settings = defaultSettings();
    await db.settings.put(settings);
  } else {
    settings = SettingsRecordSchema.parse(settings);
  }

  let syncState = await db.syncState.get(SYNC_STATE_ROW_ID);
  if (!syncState) {
    syncState = createDefaultSyncState(getSupabaseSyncStatus());
    await db.syncState.put(syncState);
  } else {
    const normalized = normalizeSyncStateRecord(syncState);
    if (JSON.stringify(normalized) !== JSON.stringify(syncState)) {
      syncState = normalized;
      await db.syncState.put(syncState);
    } else {
      syncState = normalized;
    }
  }

  let workspaceState = await db.workspaceState.get(WORKSPACE_STATE_ROW_ID);
  if (!workspaceState) {
    workspaceState = createDefaultWorkspaceState();
    await db.workspaceState.put(workspaceState);
  } else {
    const normalized = normalizeWorkspaceStateRecord(workspaceState);
    if (JSON.stringify(normalized) !== JSON.stringify(workspaceState)) {
      workspaceState = normalized;
      await db.workspaceState.put(workspaceState);
    } else {
      workspaceState = normalized;
    }
  }

  return { settings, syncState, workspaceState };
}

async function ensureDailyRecord(date: string): Promise<DailyRecord> {
  const existing = await db.dailyRecords.get(date);
  if (existing) {
    return DailyRecordSchema.parse(existing);
  }

  const created = defaultDailyRecord(date);
  await db.dailyRecords.put(created);
  return created;
}

async function ensureWeeklyRecord(weekStart: string): Promise<WeeklyRecord> {
  const existing = await db.weeklyRecords.get(weekStart);
  if (existing) {
    return WeeklyRecordSchema.parse(existing);
  }

  const created = defaultWeeklyRecord(weekStart);
  await db.weeklyRecords.put(created);
  return created;
}

async function readSettingsAndSyncSnapshot(): Promise<{
  settings: SettingsRecord;
  syncState: SyncStateRecord;
  workspaceState: WorkspaceStateRecord;
}> {
  const [settings, syncState, workspaceState] = await Promise.all([
    db.settings.get(SETTINGS_ROW_ID),
    db.syncState.get(SYNC_STATE_ROW_ID),
    db.workspaceState.get(WORKSPACE_STATE_ROW_ID),
  ]);

  return {
    settings: settings
      ? SettingsRecordSchema.parse(settings)
      : defaultSettings(),
    syncState: syncState
      ? normalizeSyncStateRecord(syncState)
      : createDefaultSyncState(getSupabaseSyncStatus()),
    workspaceState: workspaceState
      ? normalizeWorkspaceStateRecord(workspaceState)
      : createDefaultWorkspaceState(),
  };
}

async function readDailyRecordOrDefault(date: string): Promise<DailyRecord> {
  const existing = await db.dailyRecords.get(date);
  return existing
    ? DailyRecordSchema.parse(existing)
    : defaultDailyRecord(date);
}

async function readWeeklyRecordOrDefault(
  weekStart: string,
): Promise<WeeklyRecord> {
  const existing = await db.weeklyRecords.get(weekStart);
  return existing
    ? WeeklyRecordSchema.parse(existing)
    : defaultWeeklyRecord(weekStart);
}

async function queueMutation(record: MutationRecord): Promise<void> {
  await db.mutationQueue.put(record);
}

async function removeItemFromFocusEverywhere(
  itemId: string,
  options?: { queueMutations?: boolean },
): Promise<DailyRecord[]> {
  const records = await db.dailyRecords.toArray();
  const updates = records
    .filter((record) => record.focusItemIds.includes(itemId))
    .map((record) =>
      DailyRecordSchema.parse({
        ...record,
        focusItemIds: record.focusItemIds.filter((id) => id !== itemId),
        updatedAt: nowIso(),
        syncState: 'pending',
        remoteRevision: record.remoteRevision ?? null,
      }),
    );

  if (updates.length) {
    await db.dailyRecords.bulkPut(updates);
    if (options?.queueMutations) {
      for (const updated of updates) {
        await queueMutation(
          createMutationRecord(
            'dailyRecord',
            updated.date,
            'daily.focus.changed',
            {
              dailyRecord: updated,
            },
          ),
        );
      }
    }
  }

  return updates;
}

export async function bootstrapHoldfast(): Promise<void> {
  await db.transaction(
    'rw',
    db.settings,
    db.syncState,
    db.workspaceState,
    async () => {
    await ensureSettingsAndSync();
    },
  );
}

export async function getCurrentSyncState(): Promise<SyncStateRecord> {
  const { syncState } = await ensureSettingsAndSync();
  return syncState;
}

export async function getCurrentWorkspaceState(): Promise<WorkspaceStateRecord> {
  const { workspaceState } = await ensureSettingsAndSync();
  return workspaceState;
}

export async function removeDataFromDevice(): Promise<void> {
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
      db.prototypeRecoverySessions,
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
      await db.prototypeRecoverySessions.clear();
      await db.workspaceRestoreSessions.clear();
      await db.syncState.clear();
      await db.workspaceState.clear();
    },
  );

  await bootstrapHoldfast();
}

export async function updateSyncState(
  patch: Partial<
    Pick<SyncStateRecord, 'mode' | 'lastSyncedAt' | 'pullCursorByStream'>
  >,
): Promise<SyncStateRecord> {
  return db.transaction('rw', db.syncState, async () => {
    const current =
      (await db.syncState.get(SYNC_STATE_ROW_ID)) ??
      createDefaultSyncState(getSupabaseSyncStatus());
    const updated = SyncStateRecordSchema.parse({
      ...current,
      ...patch,
      updatedAt: nowIso(),
    });

    await db.syncState.put(updated);
    return updated;
  });
}

export async function updateWorkspaceState(
  patch: Partial<
    Pick<
      WorkspaceStateRecord,
      'ownershipState' | 'boundUserId' | 'authPromptState' | 'attachState'
    >
  >,
): Promise<WorkspaceStateRecord> {
  return db.transaction('rw', db.workspaceState, async () => {
    const current =
      (await db.workspaceState.get(WORKSPACE_STATE_ROW_ID)) ??
      createDefaultWorkspaceState();
    const updated = WorkspaceStateRecordSchema.parse({
      ...current,
      ...patch,
      updatedAt: nowIso(),
    });

    await db.workspaceState.put(updated);
    return updated;
  });
}

export async function detachWorkspaceAfterRestore(): Promise<WorkspaceStateRecord> {
  return updateWorkspaceState({
    ownershipState: 'device-guest',
    boundUserId: null,
    authPromptState: 'none',
    attachState: 'detached-restore',
  });
}

export async function attachWorkspaceToAccount(
  userId: string,
): Promise<WorkspaceStateRecord> {
  await updateSyncState({
    lastSyncedAt: null,
    pullCursorByStream: createDefaultSyncPullCursorMap(),
  });
  return updateWorkspaceState({
    ownershipState: 'member',
    boundUserId: userId,
    authPromptState: 'none',
    attachState: 'attached',
  });
}

export async function getHoldfastSnapshot(
  currentDate: DateKey,
): Promise<HoldfastSnapshot> {
  const weekStart = startOfWeek(currentDate);
  const [
    { settings, syncState, workspaceState },
    currentDay,
    weeklyRecord,
    items,
    attachments,
    dailyRecords,
    routines,
    lists,
    listItems,
  ] = await Promise.all([
    readSettingsAndSyncSnapshot(),
    readDailyRecordOrDefault(currentDate),
    readWeeklyRecordOrDefault(weekStart),
    db.items
      .toArray()
      .then((rows) => rows.map((item) => ItemRecordSchema.parse(item))),
    db.attachments
      .toArray()
      .then((rows) =>
        rows.map((attachment) => AttachmentRecordSchema.parse(attachment)),
      ),
    db.dailyRecords
      .toArray()
      .then((rows) => rows.map((record) => DailyRecordSchema.parse(record))),
    db.routines
      .toArray()
      .then((rows) =>
        rows.map((routine) => RoutineRecordSchema.parse(routine)),
      ),
    db.lists
      .toArray()
      .then((rows) => rows.map((list) => ListRecordSchema.parse(list))),
    db.listItems
      .toArray()
      .then((rows) =>
        rows.map((listItem) => ListItemRecordSchema.parse(listItem)),
      ),
  ]);

  const attachmentMap = new Map<string, AttachmentRecord[]>();
  for (const attachment of attachments.filter((entry) => !entry.deletedAt)) {
    const next = attachmentMap.get(attachment.itemId) ?? [];
    next.push(attachment);
    attachmentMap.set(attachment.itemId, next);
  }

  const enrichedItems = items
    .filter((item) => !item.deletedAt)
    .map((item) => ({
      ...item,
      attachments: attachmentMap.get(item.id) ?? [],
    }));
  const activeListIds = new Set(
    lists.filter((list) => !list.deletedAt).map((list) => list.id),
  );

  return {
    currentDate,
    currentDay,
    dailyRecords,
    items: enrichedItems,
    lists: lists.filter((list) => !list.deletedAt),
    listItems: listItems.filter(
      (listItem) => !listItem.deletedAt && activeListIds.has(listItem.listId),
    ),
    routines: routines.filter((routine) => !routine.deletedAt),
    settings,
    syncState,
    workspaceState,
    weeklyRecord,
  };
}

export function useHoldfastSnapshot(
  currentDate: DateKey,
): HoldfastSnapshot | null | undefined {
  return useLiveQuery(
    async () => getHoldfastSnapshot(currentDate),
    [currentDate],
  );
}

export async function createItem(input: CreateItemInput): Promise<void> {
  const record = createItemRecord(input);

  await db.transaction('rw', db.items, db.mutationQueue, async () => {
    await db.items.add(record);
    await queueMutation(
      createMutationRecord('item', record.id, 'item.created', { item: record }),
    );
  });
}

export async function saveItem(
  itemId: string,
  patch: ItemDraftPatch,
): Promise<void> {
  await db.transaction(
    'rw',
    db.items,
    db.dailyRecords,
    db.mutationQueue,
    async () => {
      const current = await db.items.get(itemId);
      if (!current) {
        return;
      }

      const timestamp = nowIso();
      const preservedSourceText =
        current.sourceText ??
        (current.kind === 'capture'
          ? [current.title, current.body].filter(Boolean).join('\n\n')
          : null);
      const nextStatus =
        patch.kind === 'capture'
          ? patch.status === 'archived'
            ? 'archived'
            : 'inbox'
          : patch.status;
      const nextScheduledDate =
        patch.kind === 'capture' ? null : patch.scheduledDate;
      const nextScheduledTime =
        patch.kind === 'capture' ? null : patch.scheduledTime;
      const updated = ItemRecordSchema.parse({
        ...current,
        title: patch.title.trim(),
        kind: patch.kind,
        lane: patch.lane,
        status: nextStatus,
        body: patch.body,
        sourceText: preservedSourceText,
        sourceItemId: current.sourceItemId ?? null,
        captureMode: current.captureMode ?? null,
        scheduledDate: nextScheduledDate,
        scheduledTime: nextScheduledTime,
        completedAt:
          nextStatus === 'done' ? (current.completedAt ?? timestamp) : null,
        archivedAt:
          nextStatus === 'archived' ? (current.archivedAt ?? timestamp) : null,
        updatedAt: timestamp,
        syncState: 'pending',
      });

      await db.items.put(updated);
      if (nextStatus !== 'today') {
        await removeItemFromFocusEverywhere(itemId, { queueMutations: true });
      }

      await queueMutation(
        createMutationRecord('item', itemId, 'item.updated', { item: updated }),
      );
    },
  );
}

export async function replaceItemWithLatestSavedVersion(
  itemId: string,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Account setup isn't ready yet.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError || !session?.user?.id) {
    throw new Error('Sign in again to use the latest saved version.');
  }

  const { data, error } = await client
    .from('items')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    throw new Error("Couldn't load the latest saved version yet.");
  }

  if (!data) {
    throw new Error("Couldn't find the latest saved version.");
  }

  const remoteItem = fromRemoteItemRow(data as RemoteItemRow);

  await db.transaction(
    'rw',
    db.items,
    db.dailyRecords,
    db.mutationQueue,
    async () => {
      const current = await db.items.get(itemId);
      if (!current) {
        return;
      }

      await db.items.put(remoteItem);

      if (remoteItem.status !== 'today') {
        await removeItemFromFocusEverywhere(itemId, {
          queueMutations: true,
        });
      }

      const queuedMutations = (await db.mutationQueue
        .where('entity')
        .equals('item')
        .toArray())
        .filter((mutation) => mutation.entityId === itemId);
      if (queuedMutations.length) {
        await db.mutationQueue.bulkDelete(
          queuedMutations.map((mutation) => mutation.id),
        );
      }
    },
  );
}

export async function replaceListWithLatestSavedVersion(
  listId: string,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Account setup isn't ready yet.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError || !session?.user?.id) {
    throw new Error('Sign in again to use the latest saved version.');
  }

  const { data, error } = await client
    .from('lists')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('id', listId)
    .maybeSingle();

  if (error) {
    throw new Error("Couldn't load the latest saved version yet.");
  }

  if (!data) {
    throw new Error("Couldn't find the latest saved version.");
  }

  const remoteList = fromRemoteListRow(data as RemoteListRow);

  await db.transaction('rw', db.lists, db.mutationQueue, async () => {
    const current = await db.lists.get(listId);
    if (!current) {
      return;
    }

    await db.lists.put(remoteList);

    const queuedMutations = (await db.mutationQueue
      .where('entity')
      .equals('list')
      .toArray()
    ).filter((mutation) => mutation.entityId === listId);
    if (queuedMutations.length) {
      await db.mutationQueue.bulkDelete(
        queuedMutations.map((mutation) => mutation.id),
      );
    }
  });
}

export async function replaceListItemWithLatestSavedVersion(
  listItemId: string,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Account setup isn't ready yet.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError || !session?.user?.id) {
    throw new Error('Sign in again to use the latest saved version.');
  }

  const { data, error } = await client
    .from('list_items')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('id', listItemId)
    .maybeSingle();

  if (error) {
    throw new Error("Couldn't load the latest saved version yet.");
  }

  if (!data) {
    throw new Error("Couldn't find the latest saved version.");
  }

  const remoteListItem = fromRemoteListItemRow(data as RemoteListItemRow);

  await db.transaction('rw', db.listItems, db.mutationQueue, async () => {
    const current = await db.listItems.get(listItemId);
    if (!current) {
      return;
    }

    await db.listItems.put(remoteListItem);

    const queuedMutations = (await db.mutationQueue
      .where('entity')
      .equals('listItem')
      .toArray()
    ).filter((mutation) => mutation.entityId === listItemId);
    if (queuedMutations.length) {
      await db.mutationQueue.bulkDelete(
        queuedMutations.map((mutation) => mutation.id),
      );
    }
  });
}

export async function deleteItem(itemId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.items,
      db.attachments,
      db.attachmentBlobs,
      db.dailyRecords,
      db.mutationQueue,
    ],
    async () => {
      const [current, attachments] = await Promise.all([
        db.items.get(itemId),
        db.attachments.where('itemId').equals(itemId).toArray(),
      ]);
      if (!current) {
        return;
      }

      await db.items.delete(itemId);
      await db.attachments.bulkDelete(
        attachments.map((attachment) => attachment.id),
      );
      await db.attachmentBlobs.bulkDelete(
        attachments.map((attachment) => attachment.blobId),
      );
      await removeItemFromFocusEverywhere(itemId, { queueMutations: true });
      for (const attachment of attachments) {
        await queueMutation(
          createMutationRecord(
            'attachment',
            attachment.id,
            'attachment.deleted',
            {
              attachmentId: attachment.id,
              remoteRevision: attachment.remoteRevision,
            },
          ),
        );
      }
      await queueMutation(
        createMutationRecord('item', itemId, 'item.deleted', {
          itemId,
          remoteRevision: current.remoteRevision,
        }),
      );
    },
  );
}

export async function toggleTaskDone(
  itemId: string,
  currentDate: DateKey,
): Promise<void> {
  await db.transaction(
    'rw',
    db.items,
    db.dailyRecords,
    db.mutationQueue,
    async () => {
      const current = await db.items.get(itemId);
      if (!current || current.kind !== 'task') {
        return;
      }

      const timestamp = nowIso();
      const isDone = current.status === 'done';
      const updated = ItemRecordSchema.parse({
        ...current,
        status: isDone ? 'today' : 'done',
        scheduledDate: isDone ? currentDate : current.scheduledDate,
        completedAt: isDone ? null : timestamp,
        archivedAt: current.status === 'archived' ? timestamp : null,
        updatedAt: timestamp,
        syncState: 'pending',
      });

      await db.items.put(updated);
      if (!isDone) {
        await removeItemFromFocusEverywhere(itemId, { queueMutations: true });
      }
      await queueMutation(
        createMutationRecord('item', itemId, 'item.status.changed', {
          item: updated,
        }),
      );
    },
  );
}

export async function toggleFocus(
  date: DateKey,
  itemId: string,
): Promise<void> {
  await db.transaction(
    'rw',
    db.items,
    db.dailyRecords,
    db.mutationQueue,
    async () => {
      const [item, day] = await Promise.all([
        db.items.get(itemId),
        ensureDailyRecord(date),
      ]);
      if (!item || item.kind === 'capture') {
        return;
      }

      const focusItemIds = day.focusItemIds.includes(itemId)
        ? day.focusItemIds.filter((id) => id !== itemId)
        : [...day.focusItemIds.filter((id) => id !== itemId).slice(-2), itemId];

      const updatedDay = DailyRecordSchema.parse({
        ...day,
        focusItemIds,
        updatedAt: nowIso(),
        syncState: 'pending',
      });

      const updatedItem =
        item.status === 'today'
          ? item
          : ItemRecordSchema.parse({
              ...item,
              status: 'today',
              scheduledDate: date,
              completedAt: null,
              archivedAt: null,
              updatedAt: nowIso(),
              syncState: 'pending',
            });

      await db.dailyRecords.put(updatedDay);
      if (updatedItem !== item) {
        await db.items.put(updatedItem);
      }

      await queueMutation(
        createMutationRecord('dailyRecord', date, 'daily.focus.changed', {
          dailyRecord: updatedDay,
        }),
      );
      if (updatedItem !== item) {
        await queueMutation(
          createMutationRecord('item', itemId, 'item.updated', {
            item: updatedItem,
          }),
        );
      }
    },
  );
}

export async function toggleReadiness(
  date: DateKey,
  key: ReadinessKey,
): Promise<void> {
  await db.transaction('rw', db.dailyRecords, db.mutationQueue, async () => {
    const current = await ensureDailyRecord(date);
    const updated = DailyRecordSchema.parse({
      ...current,
      readiness: {
        ...current.readiness,
        [key]: !current.readiness[key],
      },
      updatedAt: nowIso(),
      syncState: 'pending',
    });

    await db.dailyRecords.put(updated);
    await queueMutation(
      createMutationRecord('dailyRecord', date, 'daily.readiness.toggled', {
        date,
        key,
        value: updated.readiness[key],
      }),
    );
  });
}

export async function startDay(date: DateKey): Promise<void> {
  await db.transaction(
    'rw',
    db.dailyRecords,
    db.routines,
    db.items,
    db.mutationQueue,
    async () => {
      const day = await ensureDailyRecord(date);
      const weekday = new Date(`${date}T00:00:00`).getDay();
      const routines = await db.routines.toArray();
      const openItemsForDate = await db.items.toArray();
      const itemsToCreate: ItemRecord[] = [];
      const seededRoutineIds = [...day.seededRoutineIds];

      for (const routine of routines.filter(
        (entry) =>
          entry.active && !entry.deletedAt && entry.weekdays.includes(weekday),
      )) {
        if (seededRoutineIds.includes(routine.id)) {
          continue;
        }

        const exists = openItemsForDate.some(
          (item) =>
            !item.deletedAt &&
            item.routineId === routine.id &&
            item.sourceDate === date &&
            !['done', 'archived'].includes(item.status),
        );

        if (!exists) {
          itemsToCreate.push(
            ItemRecordSchema.parse({
              ...createItemRecord({
                title: routine.title,
                kind: 'task',
                lane: routine.lane,
                status: routine.destination === 'today' ? 'today' : 'upcoming',
                sourceDate: date,
                scheduledDate: routine.destination === 'today' ? date : null,
                scheduledTime: routine.scheduledTime,
              }),
              routineId: routine.id,
              body: routine.notes,
            }),
          );
        }

        seededRoutineIds.push(routine.id);
      }

      if (itemsToCreate.length) {
        await db.items.bulkAdd(itemsToCreate);
      }

      const updatedDay = DailyRecordSchema.parse({
        ...day,
        startedAt: day.startedAt ?? nowIso(),
        seededRoutineIds,
        updatedAt: nowIso(),
        syncState: 'pending',
      });

      await db.dailyRecords.put(updatedDay);
      await queueMutation(
        createMutationRecord('dailyRecord', date, 'daily.started', {
          dailyRecord: updatedDay,
        }),
      );
      for (const item of itemsToCreate) {
        await queueMutation(
          createMutationRecord('item', item.id, 'item.created', { item }),
        );
      }
    },
  );
}

export async function closeDay(
  date: DateKey,
  input: CloseDayInput,
): Promise<void> {
  await db.transaction(
    'rw',
    db.dailyRecords,
    db.items,
    db.mutationQueue,
    async () => {
      const [day, items] = await Promise.all([
        ensureDailyRecord(date),
        db.items.toArray(),
      ]);
      const updatedDay = DailyRecordSchema.parse({
        ...day,
        closedAt: nowIso(),
        closeWin: input.closeWin,
        closeCarry: input.closeCarry,
        closeSeed: input.closeSeed,
        closeNote: input.closeNote,
        updatedAt: nowIso(),
        syncState: 'pending',
      });

      const carryForward = buildCarryForwardTasks(
        input.closeCarry,
        addDays(date, 1),
        items,
      );
      const carryExistingItemIds = new Set(
        carryForward
          .map((entry) => entry.existingItemId)
          .filter((entry): entry is string => Boolean(entry)),
      );
      const updatedExistingItems = items
        .filter((item) => carryExistingItemIds.has(item.id))
        .map((item) =>
          ItemRecordSchema.parse({
            ...item,
            status: 'upcoming',
            scheduledDate: addDays(date, 1),
            scheduledTime: null,
            completedAt: null,
            archivedAt: null,
            updatedAt: nowIso(),
            syncState: 'pending',
          }),
        );
      const carryItems = carryForward
        .filter((entry) => !entry.existingItemId)
        .map((entry) =>
          createItemRecord({
            title: entry.title,
            kind: 'task',
            lane: 'admin',
            status: 'upcoming',
          sourceDate: date,
            scheduledDate: entry.scheduledDate,
            scheduledTime: null,
          }),
        );

      await db.dailyRecords.put(updatedDay);
      if (updatedExistingItems.length) {
        await db.items.bulkPut(updatedExistingItems);
      }
      if (carryItems.length) {
        await db.items.bulkAdd(carryItems);
      }

      await queueMutation(
        createMutationRecord('dailyRecord', date, 'daily.closed', {
          dailyRecord: updatedDay,
        }),
      );
      for (const item of carryItems) {
        await queueMutation(
          createMutationRecord('item', item.id, 'item.created', { item }),
        );
      }
      for (const item of updatedExistingItems) {
        await queueMutation(
          createMutationRecord('item', item.id, 'item.updated', { item }),
        );
      }
    },
  );
}

export async function seedLaunchFromYesterday(
  currentDate: DateKey,
): Promise<void> {
  await db.transaction('rw', db.dailyRecords, db.mutationQueue, async () => {
    const [today, previous] = await Promise.all([
      ensureDailyRecord(currentDate),
      ensureDailyRecord(addDays(currentDate, -1)),
    ]);

    if (!previous.closeSeed.trim()) {
      return;
    }

    const updated = DailyRecordSchema.parse({
      ...today,
      launchNote: previous.closeSeed.trim(),
      updatedAt: nowIso(),
      syncState: 'pending',
    });

    await db.dailyRecords.put(updated);
    await queueMutation(
      createMutationRecord('dailyRecord', currentDate, 'daily.launch.seeded', {
        date: currentDate,
        launchNote: updated.launchNote,
      }),
    );
  });
}

export async function updateSettings(
  patch: Partial<Pick<SettingsRecord, 'direction' | 'standards' | 'why'>>,
): Promise<void> {
  await db.transaction('rw', db.settings, db.mutationQueue, async () => {
    const current =
      (await db.settings.get(SETTINGS_ROW_ID)) ?? defaultSettings();
    const updated = SettingsRecordSchema.parse({
      ...current,
      ...patch,
      updatedAt: nowIso(),
      syncState: 'pending',
    });

    await db.settings.put(updated);
    await queueMutation(
      createMutationRecord(
        'settings',
        SETTINGS_ROW_ID,
        'settings.updated',
        patch,
      ),
    );
  });
}

export async function updateWeeklyRecord(
  currentDate: DateKey,
  patch: Partial<Pick<WeeklyRecord, 'focus' | 'protect' | 'notes'>>,
): Promise<void> {
  const weekStart = startOfWeek(currentDate);
  await db.transaction('rw', db.weeklyRecords, db.mutationQueue, async () => {
    const current = await ensureWeeklyRecord(weekStart);
    const updated = WeeklyRecordSchema.parse({
      ...current,
      ...patch,
      updatedAt: nowIso(),
      syncState: 'pending',
    });

    await db.weeklyRecords.put(updated);
    await queueMutation(
      createMutationRecord('weeklyRecord', weekStart, 'weekly.updated', {
        weekStart,
        ...patch,
      }),
    );
  });
}

export async function createRoutine(): Promise<void> {
  const timestamp = nowIso();
  const routine = RoutineRecordSchema.parse({
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    title: 'New routine',
    lane: 'admin',
    destination: 'today',
    weekdays: [],
    scheduledTime: null,
    notes: '',
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    syncState: 'pending',
  });

  await db.transaction('rw', db.routines, db.mutationQueue, async () => {
    await db.routines.add(routine);
    await queueMutation(
      createMutationRecord('routine', routine.id, 'routine.created', {
        routine,
      }),
    );
  });
}

export async function createList(input: CreateListInput): Promise<string> {
  const record = createListRecord(input);

  await db.transaction('rw', db.lists, db.mutationQueue, async () => {
    await db.lists.add(record);
    await queueMutation(
      createMutationRecord('list', record.id, 'list.created', { list: record }),
    );
  });

  return record.id;
}

async function nextListItemPosition(listId: string): Promise<number> {
  const existingItems = await db.listItems.where('listId').equals(listId).toArray();
  return (
    existingItems
      .filter((item) => !item.deletedAt)
      .reduce((max, item) => Math.max(max, item.position), -1) + 1
  );
}

export async function createListWithFirstItem(
  input: CreateListInput,
  firstItem: Omit<CreateListItemInput, 'listId'>,
): Promise<string> {
  const listRecord = createListRecord(input);
  const listItemRecord = createListItemRecord(
    {
      ...firstItem,
      listId: listRecord.id,
    },
    0,
  );

  await db.transaction('rw', db.lists, db.listItems, db.mutationQueue, async () => {
    await db.lists.add(listRecord);
    await db.listItems.add(listItemRecord);
    await queueMutation(
      createMutationRecord('list', listRecord.id, 'list.created', {
        list: listRecord,
      }),
    );
    await queueMutation(
      createMutationRecord('listItem', listItemRecord.id, 'list-item.created', {
        listItem: listItemRecord,
      }),
    );
  });

  return listRecord.id;
}

export async function createListItem(
  input: CreateListItemInput,
): Promise<void> {
  await db.transaction(
    'rw',
    db.lists,
    db.listItems,
    db.mutationQueue,
    async () => {
      const list = await db.lists.get(input.listId);
      if (!list || list.deletedAt) {
        return;
      }

      const position = input.position ?? (await nextListItemPosition(input.listId));
      const record = createListItemRecord(input, position);

      await db.listItems.add(record);
      await queueMutation(
        createMutationRecord('listItem', record.id, 'list-item.created', {
          listItem: record,
        }),
      );
    },
  );
}

function createListItemRecordFromItem(
  item: ItemRecord,
  listId: string,
  position: number,
  timestamp: string,
): ListItemRecord {
  return ListItemRecordSchema.parse({
    ...createListItemRecord(
      {
        listId,
        title: item.title,
        body: item.body,
        sourceItemId: item.id,
      },
      position,
    ),
    status: item.status === 'done' ? 'done' : 'open',
    completedAt:
      item.status === 'done' ? (item.completedAt ?? timestamp) : null,
  });
}

function archiveItemRecord(item: ItemRecord, timestamp: string): ItemRecord {
  return ItemRecordSchema.parse({
    ...item,
    status: 'archived',
    archivedAt: item.archivedAt ?? timestamp,
    updatedAt: timestamp,
    syncState: 'pending',
  });
}

export async function moveItemToList(
  itemId: string,
  listId: string,
): Promise<void> {
  await db.transaction(
    'rw',
    db.items,
    db.dailyRecords,
    db.lists,
    db.listItems,
    db.mutationQueue,
    async () => {
      const item = await db.items.get(itemId);
      const [list, sourceListItem] = await Promise.all([
        db.lists.get(listId),
        item?.sourceItemId ? db.listItems.get(item.sourceItemId) : Promise.resolve(null),
      ]);
      if (
        !item ||
        item.deletedAt ||
        item.status === 'archived' ||
        !list ||
        list.deletedAt
      ) {
        return;
      }

      const timestamp = nowIso();
      const sourceBelongsToTargetList =
        Boolean(sourceListItem) &&
        sourceListItem!.listId === listId &&
        sourceListItem!.promotedItemId === item.id;

      if (sourceBelongsToTargetList) {
        const restoredListItem = ListItemRecordSchema.parse({
          ...sourceListItem,
          title: item.title,
          body: item.body,
          status: item.status === 'done' ? 'done' : 'open',
          promotedItemId: null,
          completedAt:
            item.status === 'done'
              ? (sourceListItem?.completedAt ?? item.completedAt ?? timestamp)
              : null,
          updatedAt: timestamp,
          syncState: 'pending',
        });

        await db.listItems.put(restoredListItem);
        await queueMutation(
          createMutationRecord('listItem', restoredListItem.id, 'list-item.updated', {
            listItem: restoredListItem,
          }),
        );
      } else {
        const position = await nextListItemPosition(listId);
        const listItem = createListItemRecordFromItem(
          item,
          listId,
          position,
          timestamp,
        );

        await db.listItems.add(listItem);
        await queueMutation(
          createMutationRecord('listItem', listItem.id, 'list-item.created', {
            listItem,
          }),
        );
      }

      if (
        sourceListItem &&
        sourceListItem.promotedItemId === item.id &&
        !sourceBelongsToTargetList
      ) {
        const clearedSourceListItem = ListItemRecordSchema.parse({
          ...sourceListItem,
          promotedItemId: null,
          updatedAt: timestamp,
          syncState: 'pending',
        });

        await db.listItems.put(clearedSourceListItem);
        await queueMutation(
          createMutationRecord(
            'listItem',
            clearedSourceListItem.id,
            'list-item.updated',
            {
              listItem: clearedSourceListItem,
            },
          ),
        );
      }

      const archivedItem = archiveItemRecord(item, timestamp);

      await db.items.put(archivedItem);
      await removeItemFromFocusEverywhere(item.id, { queueMutations: true });
      await queueMutation(
        createMutationRecord('item', item.id, 'item.updated', {
          item: archivedItem,
        }),
      );
    },
  );
}

export async function sendInboxCaptureToList(
  itemId: string,
  listId: string,
): Promise<void> {
  await moveItemToList(itemId, listId);
}

export async function moveItemToNewList(
  itemId: string,
  input: CreateListInput,
): Promise<string | null> {
  const listRecord = createListRecord(input);

  await db.transaction(
    'rw',
    db.items,
    db.dailyRecords,
    db.lists,
    db.listItems,
    db.mutationQueue,
    async () => {
      const item = await db.items.get(itemId);
      const sourceListItem = item?.sourceItemId
        ? await db.listItems.get(item.sourceItemId)
        : null;
      if (!item || item.deletedAt || item.status === 'archived') {
        return;
      }

      const timestamp = nowIso();
      const listItem = createListItemRecordFromItem(
        item,
        listRecord.id,
        0,
        timestamp,
      );
      const archivedItem = archiveItemRecord(item, timestamp);

      await db.lists.add(listRecord);
      await db.listItems.add(listItem);
      await db.items.put(archivedItem);
      await queueMutation(
        createMutationRecord('list', listRecord.id, 'list.created', {
          list: listRecord,
        }),
      );
      await queueMutation(
        createMutationRecord('listItem', listItem.id, 'list-item.created', {
          listItem,
        }),
      );
      if (sourceListItem && sourceListItem.promotedItemId === item.id) {
        const clearedSourceListItem = ListItemRecordSchema.parse({
          ...sourceListItem,
          promotedItemId: null,
          updatedAt: timestamp,
          syncState: 'pending',
        });

        await db.listItems.put(clearedSourceListItem);
        await queueMutation(
          createMutationRecord(
            'listItem',
            clearedSourceListItem.id,
            'list-item.updated',
            {
              listItem: clearedSourceListItem,
            },
          ),
        );
      }
      await removeItemFromFocusEverywhere(item.id, { queueMutations: true });
      await queueMutation(
        createMutationRecord('item', item.id, 'item.updated', {
          item: archivedItem,
        }),
      );
    },
  );

  const createdList = await db.lists.get(listRecord.id);
  return createdList ? listRecord.id : null;
}

export async function sendInboxCaptureToNewList(
  itemId: string,
  input: CreateListInput,
): Promise<string | null> {
  return moveItemToNewList(itemId, input);
}

export async function reopenAllDoneListItems(listId: string): Promise<void> {
  await db.transaction('rw', db.listItems, db.mutationQueue, async () => {
    const doneItems = await db.listItems.where('listId').equals(listId).toArray();

    for (const item of doneItems.filter(
      (entry) => !entry.deletedAt && entry.status === 'done',
    )) {
      const updated = ListItemRecordSchema.parse({
        ...item,
        status: 'open',
        completedAt: null,
        updatedAt: nowIso(),
        syncState: 'pending',
      });

      await db.listItems.put(updated);
      await queueMutation(
        createMutationRecord('listItem', updated.id, 'list-item.updated', {
          listItem: updated,
        }),
      );
    }
  });
}

export async function updateList(
  listId: string,
  patch: UpdateListInput,
): Promise<void> {
  await db.transaction('rw', db.lists, db.mutationQueue, async () => {
    const current = await db.lists.get(listId);
    if (!current || current.deletedAt) {
      return;
    }

    const updated = ListRecordSchema.parse({
      ...current,
      title: patch.title === undefined ? current.title : patch.title.trim(),
      kind: patch.kind ?? current.kind,
      lane: patch.lane ?? current.lane,
      pinned: patch.pinned ?? current.pinned,
      archivedAt:
        patch.archivedAt === undefined ? current.archivedAt : patch.archivedAt,
      updatedAt: nowIso(),
      syncState: 'pending',
    });

    await db.lists.put(updated);
    await queueMutation(
      createMutationRecord('list', listId, 'list.updated', { list: updated }),
    );
  });
}

export async function deleteList(listId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.lists,
    db.listItems,
    db.mutationQueue,
    async () => {
      const current = await db.lists.get(listId);
      if (!current || current.deletedAt) {
        return;
      }

      const timestamp = nowIso();
      const updatedList = ListRecordSchema.parse({
        ...current,
        deletedAt: timestamp,
        updatedAt: timestamp,
        syncState: 'pending',
      });
      const currentListItems = await db.listItems
        .where('listId')
        .equals(listId)
        .toArray();
      const deletedListItems = currentListItems
        .filter((listItem) => !listItem.deletedAt)
        .map((listItem) =>
          ListItemRecordSchema.parse({
            ...listItem,
            deletedAt: timestamp,
            updatedAt: timestamp,
            syncState: 'pending',
          }),
        );

      await db.lists.put(updatedList);
      if (deletedListItems.length) {
        await db.listItems.bulkPut(deletedListItems);
      }
      await queueMutation(
        createMutationRecord('list', listId, 'list.deleted', {
          listId,
          remoteRevision: current.remoteRevision,
        }),
      );
      for (const listItem of deletedListItems) {
        await queueMutation(
          createMutationRecord('listItem', listItem.id, 'list-item.deleted', {
            listItemId: listItem.id,
            listId,
            remoteRevision: listItem.remoteRevision,
          }),
        );
      }
    },
  );
}

export async function updateListItem(
  listItemId: string,
  patch: UpdateListItemInput,
): Promise<void> {
  await db.transaction('rw', db.listItems, db.mutationQueue, async () => {
    const current = await db.listItems.get(listItemId);
    if (!current || current.deletedAt) {
      return;
    }

    const timestamp = nowIso();
    const nextStatus = patch.status ?? current.status;
    const updated = ListItemRecordSchema.parse({
      ...current,
      title: patch.title === undefined ? current.title : patch.title.trim(),
      body: patch.body ?? current.body,
      status: nextStatus,
      position: patch.position ?? current.position,
      sourceItemId:
        patch.sourceItemId === undefined
          ? current.sourceItemId
          : patch.sourceItemId,
      promotedItemId:
        patch.promotedItemId === undefined
          ? current.promotedItemId
          : patch.promotedItemId,
      completedAt:
        nextStatus === 'done' ? (current.completedAt ?? timestamp) : null,
      archivedAt:
        nextStatus === 'archived' ? (current.archivedAt ?? timestamp) : null,
      updatedAt: timestamp,
      syncState: 'pending',
    });

    await db.listItems.put(updated);
    await queueMutation(
      createMutationRecord('listItem', listItemId, 'list-item.updated', {
        listItem: updated,
      }),
    );
  });
}

export async function promoteListItemToNow(
  listItemId: string,
  currentDate: DateKey,
): Promise<void> {
  await db.transaction(
    'rw',
    db.lists,
    db.listItems,
    db.items,
    db.mutationQueue,
    async () => {
      const current = await db.listItems.get(listItemId);
      if (!current || current.deletedAt || current.promotedItemId) {
        return;
      }

      const list = await db.lists.get(current.listId);
      if (!list || list.deletedAt) {
        return;
      }

      const item = createItemRecord({
        title: current.title,
        kind: 'task',
        lane: list.lane,
        status: 'today',
        body: current.body,
        sourceText: [current.title, current.body].filter(Boolean).join('\n\n'),
        sourceItemId: current.id,
        captureMode: 'context',
        sourceDate: currentDate,
        scheduledDate: currentDate,
        scheduledTime: null,
      });
      const updatedListItem = ListItemRecordSchema.parse({
        ...current,
        promotedItemId: item.id,
        updatedAt: nowIso(),
        syncState: 'pending',
      });

      await db.items.add(item);
      await db.listItems.put(updatedListItem);
      await queueMutation(
        createMutationRecord('item', item.id, 'item.created', { item }),
      );
      await queueMutation(
        createMutationRecord('listItem', updatedListItem.id, 'list-item.updated', {
          listItem: updatedListItem,
        }),
      );
    },
  );
}

export async function deleteListItem(listItemId: string): Promise<void> {
  await db.transaction('rw', db.listItems, db.mutationQueue, async () => {
    const current = await db.listItems.get(listItemId);
    if (!current || current.deletedAt) {
      return;
    }

    const timestamp = nowIso();
    const updated = ListItemRecordSchema.parse({
      ...current,
      deletedAt: timestamp,
      updatedAt: timestamp,
      syncState: 'pending',
    });

    await db.listItems.put(updated);
    await queueMutation(
      createMutationRecord('listItem', listItemId, 'list-item.deleted', {
        listItemId,
        listId: current.listId,
        remoteRevision: current.remoteRevision,
      }),
    );
  });
}

export async function updateRoutine(
  routineId: string,
  patch: Partial<
    Pick<
      RoutineRecord,
      | 'title'
      | 'lane'
      | 'destination'
      | 'weekdays'
      | 'scheduledTime'
      | 'notes'
      | 'active'
    >
  >,
): Promise<void> {
  await db.transaction('rw', db.routines, db.mutationQueue, async () => {
    const current = await db.routines.get(routineId);
    if (!current) {
      return;
    }

    const updated = RoutineRecordSchema.parse({
      ...current,
      ...patch,
      updatedAt: nowIso(),
      syncState: 'pending',
    });

    await db.routines.put(updated);
    await queueMutation(
      createMutationRecord('routine', routineId, 'routine.updated', {
        routine: updated,
      }),
    );
  });
}

export async function deleteRoutine(routineId: string): Promise<void> {
  await db.transaction('rw', db.routines, db.mutationQueue, async () => {
    const current = await db.routines.get(routineId);
    if (!current) {
      return;
    }

    const updated = RoutineRecordSchema.parse({
      ...current,
      active: false,
      deletedAt: nowIso(),
      updatedAt: nowIso(),
      syncState: 'pending',
    });

    await db.routines.put(updated);
    await queueMutation(
      createMutationRecord('routine', routineId, 'routine.deleted', {
        routineId,
        remoteRevision: current.remoteRevision,
      }),
    );
  });
}

export async function addFilesToItem(
  itemId: string,
  files: File[],
): Promise<void> {
  if (!files.length) {
    return;
  }

  await db.transaction(
    'rw',
    db.attachments,
    db.attachmentBlobs,
    db.mutationQueue,
    async () => {
      const timestamp = nowIso();
      const blobRows = files.map((file) =>
        AttachmentBlobRecordSchema.parse({
          id: crypto.randomUUID(),
          schemaVersion: SCHEMA_VERSION,
          blob: file,
          createdAt: timestamp,
        }),
      );

      const attachmentRows = files.map((file, index) =>
        AttachmentRecordSchema.parse({
          id: crypto.randomUUID(),
          schemaVersion: SCHEMA_VERSION,
          itemId,
          blobId: blobRows[index]?.id,
          kind: attachmentKindForFile(file),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncState: 'pending',
        }),
      );

      await db.attachmentBlobs.bulkAdd(blobRows);
      await db.attachments.bulkAdd(attachmentRows);

      for (const attachment of attachmentRows) {
        await queueMutation(
          createMutationRecord(
            'attachment',
            attachment.id,
            'attachment.created',
            { attachment },
          ),
        );
      }
    },
  );
}

export async function removeAttachment(attachmentId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.attachments,
    db.attachmentBlobs,
    db.mutationQueue,
    async () => {
      const attachment = await db.attachments.get(attachmentId);
      if (!attachment) {
        return;
      }

      await db.attachments.delete(attachmentId);
      await db.attachmentBlobs.delete(attachment.blobId);
      await queueMutation(
        createMutationRecord('attachment', attachmentId, 'attachment.deleted', {
          attachmentId,
          remoteRevision: attachment.remoteRevision,
        }),
      );
    },
  );
}

export async function getAttachmentDownload(
  attachmentId: string,
): Promise<{ blob: Blob; name: string; type: string } | null> {
  const attachment = await db.attachments.get(attachmentId);
  if (!attachment) {
    return null;
  }

  const blobRow = await db.attachmentBlobs.get(attachment.blobId);
  if (!blobRow) {
    const workspaceState = await getCurrentWorkspaceState();
    const client = getSupabaseBrowserClient();
    if (
      workspaceState.ownershipState !== 'member' ||
      workspaceState.attachState !== 'attached' ||
      !workspaceState.boundUserId ||
      !client
    ) {
      return null;
    }

    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session?.user?.id || session.user.id !== workspaceState.boundUserId) {
      return null;
    }

    const blob = await downloadAttachmentBlob(
      workspaceState.boundUserId,
      attachmentId,
    ).catch(() => null);
    if (!blob) {
      return null;
    }

    await db.attachmentBlobs.put(
      AttachmentBlobRecordSchema.parse({
        id: attachment.blobId,
        schemaVersion: SCHEMA_VERSION,
        blob,
        createdAt: nowIso(),
      }),
    );

    return {
      blob,
      name: attachment.name,
      type: attachment.mimeType,
    };
  }

  return {
    blob: blobRow.blob,
    name: attachment.name,
    type: attachment.mimeType,
  };
}
