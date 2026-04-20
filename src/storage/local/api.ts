import { useLiveQuery } from 'dexie-react-hooks';

import {
  READINESS_CHECKS,
  SCHEMA_VERSION,
  SETTINGS_ROW_ID,
  SYNC_STATE_ROW_ID,
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
  type WeeklyRecord,
} from '@/domain/schemas/records';
import { db } from '@/storage/local/db';
import { downloadAttachmentBlob } from '@/storage/sync/supabase/attachments';
import { getSupabaseSyncStatus } from '@/storage/sync/supabase/config';
import {
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

  return { settings, syncState };
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
}> {
  const [settings, syncState] = await Promise.all([
    db.settings.get(SETTINGS_ROW_ID),
    db.syncState.get(SYNC_STATE_ROW_ID),
  ]);

  return {
    settings: settings
      ? SettingsRecordSchema.parse(settings)
      : defaultSettings(),
    syncState: syncState
      ? normalizeSyncStateRecord(syncState)
      : createDefaultSyncState(getSupabaseSyncStatus()),
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

async function removeItemFromFocusEverywhere(itemId: string): Promise<void> {
  const records = await db.dailyRecords.toArray();
  const updates = records
    .filter((record) => record.focusItemIds.includes(itemId))
    .map((record) =>
      DailyRecordSchema.parse({
        ...record,
        focusItemIds: record.focusItemIds.filter((id) => id !== itemId),
        updatedAt: nowIso(),
        syncState: 'pending',
      }),
    );

  if (updates.length) {
    await db.dailyRecords.bulkPut(updates);
  }
}

export async function bootstrapHoldfast(): Promise<void> {
  await db.transaction('rw', db.settings, db.syncState, async () => {
    await ensureSettingsAndSync();
  });
}

export async function getCurrentSyncState(): Promise<SyncStateRecord> {
  const { syncState } = await ensureSettingsAndSync();
  return syncState;
}

export async function updateSyncState(
  patch: Partial<
    Pick<
      SyncStateRecord,
      | 'mode'
      | 'lastSyncedAt'
      | 'authState'
      | 'identityState'
      | 'authPromptState'
      | 'remoteUserId'
    >
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

export async function getHoldfastSnapshot(
  currentDate: DateKey,
): Promise<HoldfastSnapshot> {
  const weekStart = startOfWeek(currentDate);
  const [
    { settings, syncState },
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
        await removeItemFromFocusEverywhere(itemId);
      }

      await queueMutation(
        createMutationRecord('item', itemId, 'item.updated', { item: updated }),
      );
    },
  );
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
      const attachments = await db.attachments
        .where('itemId')
        .equals(itemId)
        .toArray();
      await db.items.delete(itemId);
      await db.attachments.bulkDelete(
        attachments.map((attachment) => attachment.id),
      );
      await db.attachmentBlobs.bulkDelete(
        attachments.map((attachment) => attachment.blobId),
      );
      await removeItemFromFocusEverywhere(itemId);
      for (const attachment of attachments) {
        await queueMutation(
          createMutationRecord(
            'attachment',
            attachment.id,
            'attachment.deleted',
            {
              attachmentId: attachment.id,
            },
          ),
        );
      }
      await queueMutation(
        createMutationRecord('item', itemId, 'item.deleted', { itemId }),
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
        await removeItemFromFocusEverywhere(itemId);
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
              updatedAt: nowIso(),
              syncState: 'pending',
            });

      await db.dailyRecords.put(updatedDay);
      if (updatedItem !== item) {
        await db.items.put(updatedItem);
      }

      await queueMutation(
        createMutationRecord('dailyRecord', date, 'daily.focus.changed', {
          date,
          focusItemIds: updatedDay.focusItemIds,
        }),
      );
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
          date,
          seededRoutineIds: updatedDay.seededRoutineIds,
          createdItemIds: itemsToCreate.map((item) => item.id),
        }),
      );
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
      const carryItems = carryForward.map((entry) =>
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
      if (carryItems.length) {
        await db.items.bulkAdd(carryItems);
      }

      await queueMutation(
        createMutationRecord('dailyRecord', date, 'daily.closed', {
          date,
          closeWin: input.closeWin,
          closeCarry: input.closeCarry,
          closeSeed: input.closeSeed,
          closeNote: input.closeNote,
          carryItemIds: carryItems.map((item) => item.id),
        }),
      );
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

export async function createList(input: CreateListInput): Promise<void> {
  const record = createListRecord(input);

  await db.transaction('rw', db.lists, db.mutationQueue, async () => {
    await db.lists.add(record);
    await queueMutation(
      createMutationRecord('list', record.id, 'list.created', { list: record }),
    );
  });
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

      const existingItems = await db.listItems
        .where('listId')
        .equals(input.listId)
        .toArray();
      const position =
        input.position ??
        existingItems
          .filter((item) => !item.deletedAt)
          .reduce((max, item) => Math.max(max, item.position), -1) + 1;
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
        createMutationRecord('list', listId, 'list.deleted', { listId }),
      );
      for (const listItem of deletedListItems) {
        await queueMutation(
          createMutationRecord('listItem', listItem.id, 'list-item.deleted', {
            listItemId: listItem.id,
            listId,
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
    const syncState = await getCurrentSyncState();
    if (syncState.authState !== 'signed-in' || !syncState.remoteUserId) {
      return null;
    }

    const blob = await downloadAttachmentBlob(
      syncState.remoteUserId,
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
