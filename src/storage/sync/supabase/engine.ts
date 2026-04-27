import type { SupabaseClient } from '@supabase/supabase-js';

import { nowIso } from '@/domain/dates';
import {
  MutationRecordSchema,
  type AttachmentRecord,
  type DailyRecord,
  type ItemRecord,
  type ListItemRecord,
  type ListRecord,
  type MutationRecord,
  type RoutineRecord,
  type SettingsRecord,
  type SyncBlockedReason,
  type SyncPullCursor,
  type SyncPullCursorMap,
  type WeeklyRecord,
} from '@/domain/schemas/records';
import {
  getCurrentWorkspaceState,
  getCurrentSyncState,
  updateSyncState,
} from '@/storage/local/api';
import { db } from '@/storage/local/db';
import {
  deleteAttachmentBlob,
  uploadAttachmentBlob,
} from '@/storage/sync/supabase/attachments';
import { getSupabaseBrowserClient } from '@/storage/sync/supabase/client';
import {
  type RemoteAttachmentRow,
  type RemoteDailyRecordRow,
  type RemoteDeletedRecordRow,
  type RemoteItemRow,
  type RemoteListItemRow,
  type RemoteListRow,
  type RemoteRoutineRow,
  type RemoteSettingsRow,
  type RemoteWeeklyRecordRow,
  type SyncEntity,
  fromRemoteAttachmentRow,
  fromRemoteDailyRecordRow,
  fromRemoteItemRow,
  fromRemoteListItemRow,
  fromRemoteListRow,
  fromRemoteRoutineRow,
  fromRemoteSettingsRow,
  fromRemoteWeeklyRecordRow,
  toRemoteAttachmentRow,
  toRemoteDailyRecordRow,
  toRemoteItemRow,
  toRemoteListItemRow,
  toRemoteListRow,
  toRemoteRoutineRow,
  toRemoteSettingsRow,
  toRemoteWeeklyRecordRow,
} from '@/storage/sync/supabase/schema';

let activeSync: Promise<void> | null = null;
const REMOTE_PULL_PAGE_SIZE = 200;

type SyncableLocalRecord =
  | ItemRecord
  | ListRecord
  | ListItemRecord
  | DailyRecord
  | WeeklyRecord
  | RoutineRecord
  | SettingsRecord
  | AttachmentRecord;

function syncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Couldn't sync yet.";
}

async function setSyncBlockedState(reason: SyncBlockedReason): Promise<void> {
  await updateSyncState({
    blockedReason: reason,
    mode: reason === 'not-configured' ? 'disabled' : 'ready',
  });
}

function isDeletedMutation(mutation: MutationRecord): boolean {
  return mutation.type.endsWith('.deleted');
}

class SyncConflictError extends Error {
  constructor() {
    super('A newer version already exists in sync. Review it before sending this change again.');
  }
}

function tupleAfterCursor(
  candidate: SyncPullCursor,
  cursor: SyncPullCursor,
): boolean {
  if (!cursor.updatedAt) {
    return true;
  }

  if (!candidate.updatedAt) {
    return false;
  }

  if (candidate.updatedAt > cursor.updatedAt) {
    return true;
  }

  if (candidate.updatedAt < cursor.updatedAt) {
    return false;
  }

  if (!cursor.id) {
    return true;
  }

  return (candidate.id ?? '') > cursor.id;
}

function remoteTupleMatchesLocalBase(
  current: SyncableLocalRecord,
  remoteRevision: string | null,
): boolean {
  return Boolean(remoteRevision && current.remoteRevision === remoteRevision);
}

function cursorFromRemoteRow<
  T extends { server_updated_at?: string } & Record<string, unknown>,
>(row: T, idField: keyof T): SyncPullCursor {
  return {
    updatedAt: row.server_updated_at ?? null,
    id: row[idField] ? String(row[idField]) : null,
  };
}

async function markMutationStatus(
  mutationId: string,
  patch: Partial<Pick<MutationRecord, 'status' | 'attempts' | 'lastError'>>,
): Promise<void> {
  const current = await db.mutationQueue.get(mutationId);
  if (!current) {
    return;
  }

  await db.mutationQueue.put(
    MutationRecordSchema.parse({
      ...current,
      ...patch,
    }),
  );
}

async function acknowledgeEntityMutations(
  entity: MutationRecord['entity'],
  entityId: string,
): Promise<void> {
  const matches = await db.mutationQueue
    .filter(
      (mutation) =>
        mutation.entity === entity &&
        mutation.entityId === entityId &&
        mutation.status !== 'acknowledged',
    )
    .toArray();

  if (!matches.length) {
    return;
  }

  await db.mutationQueue.bulkPut(
    matches.map((mutation) =>
      MutationRecordSchema.parse({
        ...mutation,
        status: 'acknowledged',
        lastError: null,
      }),
    ),
  );
}

async function removeItemFromFocusEverywhere(itemId: string): Promise<void> {
  const records = await db.dailyRecords.toArray();
  const updates = records
    .filter((record) => record.focusItemIds.includes(itemId))
    .map((record) => ({
      ...record,
      focusItemIds: record.focusItemIds.filter((entry) => entry !== itemId),
      updatedAt: nowIso(),
      syncState: 'synced' as const,
    }));

  if (updates.length) {
    await db.dailyRecords.bulkPut(updates);
  }
}

async function removeListFromFocusEverywhere(listId: string): Promise<void> {
  const records = await db.dailyRecords.toArray();
  const updates = records
    .filter((record) => record.focusListIds.includes(listId))
    .map((record) => ({
      ...record,
      focusListIds: record.focusListIds.filter((entry) => entry !== listId),
      updatedAt: nowIso(),
      syncState: 'synced' as const,
    }));

  if (updates.length) {
    await db.dailyRecords.bulkPut(updates);
  }
}

async function deleteLocalAttachment(attachmentId: string): Promise<void> {
  const attachment = await db.attachments.get(attachmentId);
  if (!attachment) {
    return;
  }

  await db.attachments.delete(attachmentId);
  await db.attachmentBlobs.delete(attachment.blobId);
}

async function deleteLocalItemCascade(itemId: string): Promise<void> {
  const attachments = await db.attachments.where('itemId').equals(itemId).toArray();

  await db.items.delete(itemId);
  await db.attachments.bulkDelete(attachments.map((attachment) => attachment.id));
  await db.attachmentBlobs.bulkDelete(
    attachments.map((attachment) => attachment.blobId),
  );
  await removeItemFromFocusEverywhere(itemId);
}

async function itemHasUnsyncedAttachmentWork(itemId: string): Promise<boolean> {
  const attachments = await db.attachments.where('itemId').equals(itemId).toArray();
  const activeAttachmentIds = new Set(
    attachments
      .filter((attachment) => !attachment.deletedAt)
      .map((attachment) => attachment.id),
  );

  if (!activeAttachmentIds.size) {
    return false;
  }

  if (
    attachments.some(
      (attachment) =>
        !attachment.deletedAt &&
        (attachment.syncState !== 'synced' || !attachment.remoteRevision),
    )
  ) {
    return true;
  }

  return (
    (await db.mutationQueue
      .filter(
        (mutation) =>
          mutation.entity === 'attachment' &&
          activeAttachmentIds.has(mutation.entityId) &&
          (mutation.status === 'pending' || mutation.status === 'failed'),
      )
      .count()) > 0
  );
}

async function deleteLocalListCascade(listId: string): Promise<void> {
  const listItems = await db.listItems.where('listId').equals(listId).toArray();
  await db.lists.delete(listId);
  await db.listItems.bulkDelete(listItems.map((listItem) => listItem.id));
  await removeListFromFocusEverywhere(listId);
}

async function getLocalEntityRecord(
  entity: MutationRecord['entity'],
  entityId: string,
): Promise<
  | SyncableLocalRecord
  | undefined
> {
  switch (entity) {
    case 'item':
      return db.items.get(entityId);
    case 'list':
      return db.lists.get(entityId);
    case 'listItem':
      return db.listItems.get(entityId);
    case 'dailyRecord':
      return db.dailyRecords.get(entityId);
    case 'weeklyRecord':
      return db.weeklyRecords.get(entityId);
    case 'routine':
      return db.routines.get(entityId);
    case 'settings':
      return db.settings.get(entityId);
    case 'attachment':
      return db.attachments.get(entityId);
  }
}

async function putLocalEntityRecord(
  entity: MutationRecord['entity'],
  record: SyncableLocalRecord,
): Promise<void> {
  switch (entity) {
    case 'item':
      await db.items.put(record as ItemRecord);
      return;
    case 'list':
      await db.lists.put(record as ListRecord);
      return;
    case 'listItem':
      await db.listItems.put(record as ListItemRecord);
      return;
    case 'dailyRecord':
      await db.dailyRecords.put(record as DailyRecord);
      return;
    case 'weeklyRecord':
      await db.weeklyRecords.put(record as WeeklyRecord);
      return;
    case 'routine':
      await db.routines.put(record as RoutineRecord);
      return;
    case 'settings':
      await db.settings.put(record as SettingsRecord);
      return;
    case 'attachment':
      await db.attachments.put(record as AttachmentRecord);
  }
}

function comparableLocalRecord(record: SyncableLocalRecord): Record<string, unknown> {
  const stable = { ...record } as Record<string, unknown>;
  delete stable.remoteRevision;
  delete stable.syncState;
  return stable;
}

function recordsEquivalent(
  left: SyncableLocalRecord,
  right: SyncableLocalRecord,
): boolean {
  return (
    JSON.stringify(comparableLocalRecord(left)) ===
    JSON.stringify(comparableLocalRecord(right))
  );
}

async function markLocalEntitySynced(
  entity: MutationRecord['entity'],
  entityId: string,
  remoteRevision: string | null,
  expectedRecord: SyncableLocalRecord,
): Promise<void> {
  const current = await getLocalEntityRecord(entity, entityId);
  if (!current) {
    return;
  }

  const stillCurrentVersion =
    JSON.stringify(comparableLocalRecord(current)) ===
    JSON.stringify(comparableLocalRecord(expectedRecord));
  await putLocalEntityRecord(entity, {
    ...current,
    syncState:
      current.syncState === 'conflict'
        ? 'conflict'
        : stillCurrentVersion
          ? 'synced'
          : 'pending',
    remoteRevision: remoteRevision ?? current.remoteRevision ?? null,
  });
}

async function markLocalEntityConflict(
  entity: MutationRecord['entity'],
  entityId: string,
  remoteRevision: string | null,
): Promise<void> {
  const current = await getLocalEntityRecord(entity, entityId);
  if (!current) {
    return;
  }

  await putLocalEntityRecord(entity, {
    ...current,
    syncState: 'conflict',
    remoteRevision: remoteRevision ?? current.remoteRevision ?? null,
  });
}

async function upsertDeletedRecord(
  client: SupabaseClient,
  userId: string,
  entity: SyncEntity,
  recordId: string,
  deletedAt: string,
): Promise<void> {
  const { error } = await client.from('deleted_records').upsert(
    {
      user_id: userId,
      entity,
      record_id: recordId,
      deleted_at: deletedAt,
    },
    {
      onConflict: 'user_id,entity,record_id',
    },
  );

  if (error) {
    throw new Error("Couldn't record the deletion yet.");
  }
}

async function clearDeletedRecord(
  client: SupabaseClient,
  userId: string,
  entity: SyncEntity,
  recordId: string,
): Promise<void> {
  const { error } = await client
    .from('deleted_records')
    .delete()
    .eq('user_id', userId)
    .eq('entity', entity)
    .eq('record_id', recordId);

  if (error) {
    throw new Error("Couldn't clear the deletion marker yet.");
  }
}

async function fetchRemoteExisting(
  client: SupabaseClient,
  userId: string,
  entity: MutationRecord['entity'],
  entityId: string,
): Promise<{ record: SyncableLocalRecord; serverUpdatedAt: string | null } | null> {
  switch (entity) {
    case 'item': {
      const { data, error } = await client
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote item state.");
      }
      return data
        ? {
            record: fromRemoteItemRow(data as RemoteItemRow),
            serverUpdatedAt: data.server_updated_at ?? null,
          }
        : null;
    }
    case 'list': {
      const { data, error } = await client
        .from('lists')
        .select('*')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote list state.");
      }
      return data
        ? {
            record: fromRemoteListRow(data as RemoteListRow),
            serverUpdatedAt: data.server_updated_at ?? null,
          }
        : null;
    }
    case 'listItem': {
      const { data, error } = await client
        .from('list_items')
        .select('*')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote list item state.");
      }
      return data
        ? {
            record: fromRemoteListItemRow(data as RemoteListItemRow),
            serverUpdatedAt: data.server_updated_at ?? null,
          }
        : null;
    }
    case 'dailyRecord': {
      const { data, error } = await client
        .from('daily_records')
        .select('*')
        .eq('user_id', userId)
        .eq('date', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote day state.");
      }
      return data
        ? {
            record: fromRemoteDailyRecordRow(data as RemoteDailyRecordRow),
            serverUpdatedAt: data.server_updated_at ?? null,
          }
        : null;
    }
    case 'weeklyRecord': {
      const { data, error } = await client
        .from('weekly_records')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote week state.");
      }
      return data
        ? {
            record: fromRemoteWeeklyRecordRow(data as RemoteWeeklyRecordRow),
            serverUpdatedAt: data.server_updated_at ?? null,
          }
        : null;
    }
    case 'routine': {
      const { data, error } = await client
        .from('routines')
        .select('*')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote routine state.");
      }
      return data
        ? {
            record: fromRemoteRoutineRow(data as RemoteRoutineRow),
            serverUpdatedAt: data.server_updated_at ?? null,
          }
        : null;
    }
    case 'settings': {
      const { data, error } = await client
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote settings.");
      }
      return data
        ? {
            record: fromRemoteSettingsRow(data as RemoteSettingsRow),
            serverUpdatedAt: data.server_updated_at ?? null,
          }
        : null;
    }
    case 'attachment': {
      const { data, error } = await client
        .from('attachments')
        .select('*')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote attachment state.");
      }
      return data
        ? {
            record: fromRemoteAttachmentRow(data as RemoteAttachmentRow),
            serverUpdatedAt: data.server_updated_at ?? null,
          }
        : null;
    }
  }
}

async function pushCurrentRecord(
  client: SupabaseClient,
  userId: string,
  mutation: MutationRecord,
): Promise<void> {
  const current = await getLocalEntityRecord(mutation.entity, mutation.entityId);

  if (!current) {
    return;
  }

  const recordAtSend = current;
  const isRestoreMutation = mutation.type.endsWith('.restored');

  const remoteExisting = await fetchRemoteExisting(
    client,
    userId,
    mutation.entity,
    mutation.entityId,
  );
  if (
    remoteExisting &&
    !isRestoreMutation &&
    !remoteTupleMatchesLocalBase(current, remoteExisting.serverUpdatedAt)
  ) {
    if (recordsEquivalent(current, remoteExisting.record)) {
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        remoteExisting.serverUpdatedAt,
        recordAtSend,
      );
      return;
    }

    await markLocalEntityConflict(
      mutation.entity,
      mutation.entityId,
      remoteExisting.serverUpdatedAt,
    );
    throw new SyncConflictError();
  }

  switch (mutation.entity) {
    case 'item': {
      const { data, error } = await client
        .from('items')
        .upsert(toRemoteItemRow(userId, current as ItemRecord))
        .select('server_updated_at')
        .single();
      if (error) {
        throw new Error("Couldn't sync the item yet.");
      }
      await clearDeletedRecord(client, userId, 'item', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        data?.server_updated_at ?? current.remoteRevision,
        recordAtSend,
      );
      return;
    }
    case 'list': {
      const { data, error } = await client
        .from('lists')
        .upsert(toRemoteListRow(userId, current as ListRecord))
        .select('server_updated_at')
        .single();
      if (error) {
        throw new Error("Couldn't sync the list yet.");
      }
      await clearDeletedRecord(client, userId, 'list', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        data?.server_updated_at ?? current.remoteRevision,
        recordAtSend,
      );
      return;
    }
    case 'listItem': {
      const { data, error } = await client
        .from('list_items')
        .upsert(toRemoteListItemRow(userId, current as ListItemRecord))
        .select('server_updated_at')
        .single();
      if (error) {
        throw new Error("Couldn't sync the list item yet.");
      }
      await clearDeletedRecord(client, userId, 'listItem', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        data?.server_updated_at ?? current.remoteRevision,
        recordAtSend,
      );
      return;
    }
    case 'dailyRecord': {
      const { data, error } = await client
        .from('daily_records')
        .upsert(toRemoteDailyRecordRow(userId, current as DailyRecord), {
          onConflict: 'user_id,date',
        })
        .select('server_updated_at')
        .single();
      if (error) {
        throw new Error("Couldn't sync the day yet.");
      }
      await clearDeletedRecord(client, userId, 'dailyRecord', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        data?.server_updated_at ?? current.remoteRevision,
        recordAtSend,
      );
      return;
    }
    case 'weeklyRecord': {
      const { data, error } = await client
        .from('weekly_records')
        .upsert(toRemoteWeeklyRecordRow(userId, current as WeeklyRecord), {
          onConflict: 'user_id,week_start',
        })
        .select('server_updated_at')
        .single();
      if (error) {
        throw new Error("Couldn't sync the week yet.");
      }
      await clearDeletedRecord(client, userId, 'weeklyRecord', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        data?.server_updated_at ?? current.remoteRevision,
        recordAtSend,
      );
      return;
    }
    case 'routine': {
      const { data, error } = await client
        .from('routines')
        .upsert(toRemoteRoutineRow(userId, current as RoutineRecord))
        .select('server_updated_at')
        .single();
      if (error) {
        throw new Error("Couldn't sync the routine yet.");
      }
      await clearDeletedRecord(client, userId, 'routine', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        data?.server_updated_at ?? current.remoteRevision,
        recordAtSend,
      );
      return;
    }
    case 'settings': {
      const { data, error } = await client
        .from('settings')
        .upsert(toRemoteSettingsRow(userId, current as SettingsRecord), {
          onConflict: 'user_id',
        })
        .select('server_updated_at')
        .single();
      if (error) {
        throw new Error("Couldn't sync settings yet.");
      }
      await clearDeletedRecord(client, userId, 'settings', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        data?.server_updated_at ?? current.remoteRevision,
        recordAtSend,
      );
      return;
    }
    case 'attachment': {
      const attachment = current as AttachmentRecord;
      const blobRow = await db.attachmentBlobs.get(attachment.blobId);
      const payloadState =
        (
          mutation.payload as {
            payloadState?: 'embedded' | 'missing';
          }
        ).payloadState ?? 'embedded';

      if (blobRow) {
        await uploadAttachmentBlob(
          userId,
          attachment.id,
          blobRow.blob,
          attachment.mimeType,
        );
      } else if (payloadState !== 'missing') {
        throw new Error("Couldn't find the attachment file to sync.");
      }
      const { data, error } = await client
        .from('attachments')
        .upsert(toRemoteAttachmentRow(userId, attachment))
        .select('server_updated_at')
        .single();
      if (error) {
        throw new Error("Couldn't sync the attachment yet.");
      }
      await clearDeletedRecord(client, userId, 'attachment', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        data?.server_updated_at ?? attachment.remoteRevision,
        recordAtSend,
      );
    }
  }
}

async function countPendingMutations(): Promise<number> {
  return db.mutationQueue
    .filter((mutation) => mutation.status === 'pending')
    .count();
}

async function countFailedMutations(): Promise<number> {
  return db.mutationQueue
    .filter((mutation) => mutation.status === 'failed')
    .count();
}

async function processDeletionMutation(
  client: SupabaseClient,
  userId: string,
  mutation: MutationRecord,
): Promise<void> {
  const expectedRemoteRevision =
    (
      mutation.payload as {
        remoteRevision?: string | null;
      }
    ).remoteRevision ?? null;
  const remoteExisting = await fetchRemoteExisting(
    client,
    userId,
    mutation.entity,
    mutation.entityId,
  );
  if (
    remoteExisting &&
    expectedRemoteRevision &&
    remoteExisting.serverUpdatedAt !== expectedRemoteRevision
  ) {
    throw new SyncConflictError();
  }

  await upsertDeletedRecord(
    client,
    userId,
    mutation.entity,
    mutation.entityId,
    mutation.createdAt,
  );

  switch (mutation.entity) {
    case 'item': {
      const { error } = await client
        .from('items')
        .delete()
        .eq('user_id', userId)
        .eq('id', mutation.entityId);
      if (!error) {
        return;
      }
      throw new Error("Couldn't delete the item from sync yet.");
    }
    case 'list': {
      const { error } = await client
        .from('lists')
        .delete()
        .eq('user_id', userId)
        .eq('id', mutation.entityId);
      if (!error) {
        return;
      }
      throw new Error("Couldn't delete the list from sync yet.");
    }
    case 'listItem': {
      const { error } = await client
        .from('list_items')
        .delete()
        .eq('user_id', userId)
        .eq('id', mutation.entityId);
      if (!error) {
        return;
      }
      throw new Error("Couldn't delete the list item from sync yet.");
    }
    case 'routine': {
      const { error } = await client
        .from('routines')
        .delete()
        .eq('user_id', userId)
        .eq('id', mutation.entityId);
      if (!error) {
        return;
      }
      throw new Error("Couldn't delete the routine from sync yet.");
    }
    case 'attachment': {
      await deleteAttachmentBlob(userId, mutation.entityId);
      const { error } = await client
        .from('attachments')
        .delete()
        .eq('user_id', userId)
        .eq('id', mutation.entityId);
      if (!error) {
        return;
      }
      throw new Error("Couldn't delete the attachment from sync yet.");
    }
    case 'dailyRecord':
    case 'weeklyRecord':
    case 'settings':
      return;
  }
}

async function pushPendingMutations(
  client: SupabaseClient,
  userId: string,
): Promise<{ failedCount: number; lastFailureAt: string | null }> {
  const pendingMutations = (await db.mutationQueue.toArray())
    .filter(
      (mutation) =>
        mutation.status === 'pending' || mutation.status === 'failed',
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  let failedCount = 0;
  let lastFailureAt: string | null = null;

  for (const mutation of pendingMutations) {
    try {
      await markMutationStatus(mutation.id, {
        status: 'sent',
        attempts: mutation.attempts + 1,
        lastError: null,
      });

      if (isDeletedMutation(mutation)) {
        await processDeletionMutation(client, userId, mutation);
      } else {
        await pushCurrentRecord(client, userId, mutation);
      }

      await markMutationStatus(mutation.id, {
        status: 'acknowledged',
        lastError: null,
      });
    } catch (error) {
      failedCount += 1;
      lastFailureAt = nowIso();
      await markMutationStatus(mutation.id, {
        status: 'failed',
        lastError: syncErrorMessage(error),
      });
    }
  }

  return {
    failedCount,
    lastFailureAt,
  };
}

async function shouldDeferToLocalPendingState(
  entity: MutationRecord['entity'],
  entityId: string,
  current: SyncableLocalRecord | undefined,
  remoteRevision: string | null,
  remoteRecord?: SyncableLocalRecord,
): Promise<boolean> {
  if (!current) {
    return false;
  }

  if (current.syncState === 'conflict') {
    return true;
  }

  if (current.syncState === 'pending') {
    if (!remoteRevision || remoteTupleMatchesLocalBase(current, remoteRevision)) {
      return true;
    }

    if (remoteRecord && recordsEquivalent(current, remoteRecord)) {
      await markLocalEntitySynced(entity, entityId, remoteRevision, current);
      await acknowledgeEntityMutations(entity, entityId);
      return true;
    }

    await markLocalEntityConflict(entity, entityId, remoteRevision);
    return true;
  }

  return false;
}

async function putRemoteAttachmentRow(row: RemoteAttachmentRow): Promise<void> {
  const current = await db.attachments.get(row.id);
  const nextAttachment = fromRemoteAttachmentRow(row);
  const nextAttachmentWithLocalBlob = {
    ...nextAttachment,
    blobId: current?.blobId ?? nextAttachment.blobId,
  };
  if (
    await shouldDeferToLocalPendingState(
      'attachment',
      row.id,
      current,
      row.server_updated_at ?? row.updated_at,
      nextAttachmentWithLocalBlob,
    )
  ) {
    return;
  }

  await db.attachments.put(nextAttachmentWithLocalBlob);
  await acknowledgeEntityMutations('attachment', row.id);
}

async function putRemoteItemRow(row: RemoteItemRow): Promise<void> {
  const current = await db.items.get(row.id);
  const nextItem = fromRemoteItemRow(row);
  if (
    await shouldDeferToLocalPendingState(
      'item',
      row.id,
      current,
      row.server_updated_at ?? row.updated_at,
      nextItem,
    )
  ) {
    return;
  }

  await db.items.put(nextItem);
  await acknowledgeEntityMutations('item', row.id);
}

async function putRemoteListRow(row: RemoteListRow): Promise<void> {
  const current = await db.lists.get(row.id);
  const nextList = fromRemoteListRow(row);
  if (
    await shouldDeferToLocalPendingState(
      'list',
      row.id,
      current,
      row.server_updated_at ?? row.updated_at,
      nextList,
    )
  ) {
    return;
  }

  await db.lists.put(nextList);
  if (nextList.archivedAt) {
    await removeListFromFocusEverywhere(nextList.id);
  }
  await acknowledgeEntityMutations('list', row.id);
}

async function putRemoteListItemRow(row: RemoteListItemRow): Promise<void> {
  const current = await db.listItems.get(row.id);
  const nextListItem = fromRemoteListItemRow(row);
  if (
    await shouldDeferToLocalPendingState(
      'listItem',
      row.id,
      current,
      row.server_updated_at ?? row.updated_at,
      nextListItem,
    )
  ) {
    return;
  }

  await db.listItems.put(nextListItem);
  await acknowledgeEntityMutations('listItem', row.id);
}

async function putRemoteDailyRecordRow(row: RemoteDailyRecordRow): Promise<void> {
  const current = await db.dailyRecords.get(row.date);
  const nextDailyRecord = fromRemoteDailyRecordRow(row);
  if (
    await shouldDeferToLocalPendingState(
      'dailyRecord',
      row.date,
      current,
      row.server_updated_at ?? row.updated_at,
      nextDailyRecord,
    )
  ) {
    return;
  }

  await db.dailyRecords.put(nextDailyRecord);
  await acknowledgeEntityMutations('dailyRecord', row.date);
}

async function putRemoteWeeklyRecordRow(
  row: RemoteWeeklyRecordRow,
): Promise<void> {
  const current = await db.weeklyRecords.get(row.week_start);
  const nextWeeklyRecord = fromRemoteWeeklyRecordRow(row);
  if (
    await shouldDeferToLocalPendingState(
      'weeklyRecord',
      row.week_start,
      current,
      row.server_updated_at ?? row.updated_at,
      nextWeeklyRecord,
    )
  ) {
    return;
  }

  await db.weeklyRecords.put(nextWeeklyRecord);
  await acknowledgeEntityMutations('weeklyRecord', row.week_start);
}

async function putRemoteRoutineRow(row: RemoteRoutineRow): Promise<void> {
  const current = await db.routines.get(row.id);
  const nextRoutine = fromRemoteRoutineRow(row);
  if (
    await shouldDeferToLocalPendingState(
      'routine',
      row.id,
      current,
      row.server_updated_at ?? row.updated_at,
      nextRoutine,
    )
  ) {
    return;
  }

  await db.routines.put(nextRoutine);
  await acknowledgeEntityMutations('routine', row.id);
}

async function putRemoteSettingsRow(row: RemoteSettingsRow): Promise<void> {
  const current = await db.settings.get('settings');
  const nextSettings = fromRemoteSettingsRow(row);
  if (
    await shouldDeferToLocalPendingState(
      'settings',
      'settings',
      current,
      row.server_updated_at ?? row.updated_at,
      nextSettings,
    )
  ) {
    return;
  }

  await db.settings.put(nextSettings);
  await acknowledgeEntityMutations('settings', 'settings');
}

async function applyRemoteDeletion(
  entity: SyncEntity,
  recordId: string,
  deletedAt: string,
): Promise<void> {
  switch (entity) {
    case 'item': {
      const current = await db.items.get(recordId);
      if (
        await shouldDeferToLocalPendingState(
          'item',
          recordId,
          current,
          deletedAt,
        )
      ) {
        return;
      }
      if (await itemHasUnsyncedAttachmentWork(recordId)) {
        if (current) {
          await markLocalEntityConflict('item', recordId, deletedAt);
        }
        return;
      }

      await deleteLocalItemCascade(recordId);
      await acknowledgeEntityMutations('item', recordId);
      return;
    }
    case 'list': {
      const current = await db.lists.get(recordId);
      if (
        await shouldDeferToLocalPendingState(
          'list',
          recordId,
          current,
          deletedAt,
        )
      ) {
        return;
      }

      await deleteLocalListCascade(recordId);
      await acknowledgeEntityMutations('list', recordId);
      return;
    }
    case 'listItem': {
      const current = await db.listItems.get(recordId);
      if (
        await shouldDeferToLocalPendingState(
          'listItem',
          recordId,
          current,
          deletedAt,
        )
      ) {
        return;
      }

      await db.listItems.delete(recordId);
      await acknowledgeEntityMutations('listItem', recordId);
      return;
    }
    case 'routine': {
      const current = await db.routines.get(recordId);
      if (
        await shouldDeferToLocalPendingState(
          'routine',
          recordId,
          current,
          deletedAt,
        )
      ) {
        return;
      }

      await db.routines.delete(recordId);
      await acknowledgeEntityMutations('routine', recordId);
      return;
    }
    case 'attachment': {
      const current = await db.attachments.get(recordId);
      if (
        await shouldDeferToLocalPendingState(
          'attachment',
          recordId,
          current,
          deletedAt,
        )
      ) {
        return;
      }

      await deleteLocalAttachment(recordId);
      await acknowledgeEntityMutations('attachment', recordId);
      return;
    }
    case 'dailyRecord':
    case 'weeklyRecord':
    case 'settings':
      return;
  }
}

async function fetchRemoteRowsByCursor<
  T extends { server_updated_at?: string } & Record<string, unknown>,
>(
  client: SupabaseClient,
  userId: string,
  table: string,
  cursor: SyncPullCursor,
  idField: keyof T,
): Promise<{ cursor: SyncPullCursor; rows: T[] }> {
  const rows: T[] = [];
  let nextCursor = { ...cursor };
  let offset = 0;

  while (true) {
    let query = client
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('server_updated_at', {
        ascending: true,
      })
      .order(String(idField), {
        ascending: true,
      })
      .range(offset, offset + REMOTE_PULL_PAGE_SIZE - 1);

    if (cursor.updatedAt) {
      query = query.gte('server_updated_at', cursor.updatedAt);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error("Couldn't pull the latest changes yet.");
    }

    const page = (data ?? []) as T[];
    const filtered = page.filter((row) =>
      tupleAfterCursor(cursorFromRemoteRow(row, idField), cursor),
    );

    if (filtered.length) {
      rows.push(...filtered);
      nextCursor = cursorFromRemoteRow(filtered[filtered.length - 1]!, idField);
    }

    if (page.length < REMOTE_PULL_PAGE_SIZE) {
      break;
    }

    offset += REMOTE_PULL_PAGE_SIZE;
  }

  return { cursor: nextCursor, rows };
}

function nextWatermark(
  current: string,
  candidates: Array<string | undefined>,
): string {
  return candidates.reduce(
    (latest, value) => (value && value > latest ? value : latest),
    current,
  );
}

async function pullRemoteChanges(
  client: SupabaseClient,
  userId: string,
  currentSyncState: Awaited<ReturnType<typeof getCurrentSyncState>>,
): Promise<{
  lastSyncedAt: string;
  pullCursorByStream: SyncPullCursorMap;
}> {
  const baseline = currentSyncState.lastSyncedAt ?? nowIso();
  const [
    itemsResult,
    listsResult,
    listItemsResult,
    dailyRecordsResult,
    weeklyRecordsResult,
    routinesResult,
    settingsResult,
    attachmentsResult,
    deletedRecordsResult,
  ] = await Promise.all([
    fetchRemoteRowsByCursor<RemoteItemRow>(
      client,
      userId,
      'items',
      currentSyncState.pullCursorByStream.items,
      'id',
    ),
    fetchRemoteRowsByCursor<RemoteListRow>(
      client,
      userId,
      'lists',
      currentSyncState.pullCursorByStream.lists,
      'id',
    ),
    fetchRemoteRowsByCursor<RemoteListItemRow>(
      client,
      userId,
      'list_items',
      currentSyncState.pullCursorByStream.listItems,
      'id',
    ),
    fetchRemoteRowsByCursor<RemoteDailyRecordRow>(
      client,
      userId,
      'daily_records',
      currentSyncState.pullCursorByStream.dailyRecords,
      'date',
    ),
    fetchRemoteRowsByCursor<RemoteWeeklyRecordRow>(
      client,
      userId,
      'weekly_records',
      currentSyncState.pullCursorByStream.weeklyRecords,
      'week_start',
    ),
    fetchRemoteRowsByCursor<RemoteRoutineRow>(
      client,
      userId,
      'routines',
      currentSyncState.pullCursorByStream.routines,
      'id',
    ),
    fetchRemoteRowsByCursor<RemoteSettingsRow>(
      client,
      userId,
      'settings',
      currentSyncState.pullCursorByStream.settings,
      'user_id',
    ),
    fetchRemoteRowsByCursor<RemoteAttachmentRow>(
      client,
      userId,
      'attachments',
      currentSyncState.pullCursorByStream.attachments,
      'id',
    ),
    fetchRemoteRowsByCursor<RemoteDeletedRecordRow>(
      client,
      userId,
      'deleted_records',
      currentSyncState.pullCursorByStream.deletedRecords,
      'record_id',
    ),
  ]);

  const items = itemsResult.rows;
  const lists = listsResult.rows;
  const listItems = listItemsResult.rows;
  const dailyRecords = dailyRecordsResult.rows;
  const weeklyRecords = weeklyRecordsResult.rows;
  const routines = routinesResult.rows;
  const settings = settingsResult.rows;
  const attachments = attachmentsResult.rows;
  const deletedRecords = deletedRecordsResult.rows;

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
    ],
    async () => {
      for (const row of items) {
        await putRemoteItemRow(row);
      }
      for (const row of lists) {
        await putRemoteListRow(row);
      }
      for (const row of listItems) {
        await putRemoteListItemRow(row);
      }
      for (const row of dailyRecords) {
        await putRemoteDailyRecordRow(row);
      }
      for (const row of weeklyRecords) {
        await putRemoteWeeklyRecordRow(row);
      }
      for (const row of routines) {
        await putRemoteRoutineRow(row);
      }
      for (const row of settings) {
        await putRemoteSettingsRow(row);
      }
      for (const row of attachments) {
        await putRemoteAttachmentRow(row);
      }
      for (const deletion of deletedRecords) {
        await applyRemoteDeletion(
          deletion.entity,
          deletion.record_id,
          deletion.deleted_at,
        );
      }
    },
  );

  return {
    lastSyncedAt: nextWatermark(baseline, [
      ...items.map((row) => row.server_updated_at),
      ...lists.map((row) => row.server_updated_at),
      ...listItems.map((row) => row.server_updated_at),
      ...dailyRecords.map((row) => row.server_updated_at),
      ...weeklyRecords.map((row) => row.server_updated_at),
      ...routines.map((row) => row.server_updated_at),
      ...settings.map((row) => row.server_updated_at),
      ...attachments.map((row) => row.server_updated_at),
      ...deletedRecords.map((row) => row.server_updated_at),
    ]),
    pullCursorByStream: {
      items: itemsResult.cursor,
      lists: listsResult.cursor,
      listItems: listItemsResult.cursor,
      dailyRecords: dailyRecordsResult.cursor,
      weeklyRecords: weeklyRecordsResult.cursor,
      routines: routinesResult.cursor,
      settings: settingsResult.cursor,
      attachments: attachmentsResult.cursor,
      deletedRecords: deletedRecordsResult.cursor,
    },
  };
}

async function runSync(client: SupabaseClient, userId: string): Promise<void> {
  const initialSyncState = await getCurrentSyncState();
  await updateSyncState({
    blockedReason: null,
    mode: 'syncing',
  });

  try {
    let syncState = initialSyncState;
    let lastFailureAt: string | null = null;
    let nextPullState = {
      lastSyncedAt: syncState.lastSyncedAt ?? nowIso(),
      pullCursorByStream: syncState.pullCursorByStream,
    };

    for (let pass = 0; pass < 5; pass += 1) {
      const mutationSummary = await pushPendingMutations(client, userId);
      lastFailureAt = mutationSummary.lastFailureAt ?? lastFailureAt;
      nextPullState = await pullRemoteChanges(client, userId, syncState);
      syncState = {
        ...syncState,
        lastSyncedAt: nextPullState.lastSyncedAt,
        pullCursorByStream: nextPullState.pullCursorByStream,
      };

      if ((await countPendingMutations()) === 0) {
        break;
      }
    }

    const remainingFailedMutationCount = await countFailedMutations();

    await updateSyncState({
      blockedReason: null,
      lastSyncedAt: nextPullState.lastSyncedAt,
      lastFailureAt,
      lastTransportError: null,
      mode: remainingFailedMutationCount > 0 ? 'error' : 'ready',
      pullCursorByStream: nextPullState.pullCursorByStream,
    });
  } catch (error) {
    await updateSyncState({
      blockedReason: null,
      lastFailureAt: nowIso(),
      lastTransportError: syncErrorMessage(error),
      mode: 'error',
    });
    throw error;
  }
}

export async function syncHoldfastWithSupabase(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    await setSyncBlockedState('not-configured');
    return;
  }

  const workspaceState = await getCurrentWorkspaceState();
  if (workspaceState.authPromptState === 'account-mismatch') {
    await setSyncBlockedState('account-mismatch');
    return;
  }
  if (workspaceState.attachState !== 'attached') {
    await setSyncBlockedState('detached-restore');
    return;
  }
  if (
    workspaceState.ownershipState === 'member' &&
    !workspaceState.boundUserId
  ) {
    await setSyncBlockedState('signed-out');
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await setSyncBlockedState('offline');
    return;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.user?.id) {
    await setSyncBlockedState('signed-out');
    return;
  }

  if (
    workspaceState.ownershipState === 'member' &&
    workspaceState.boundUserId &&
    workspaceState.boundUserId !== session.user.id
  ) {
    await setSyncBlockedState('account-mismatch');
    return;
  }

  if (!activeSync) {
    activeSync = runSync(client, session.user.id).finally(() => {
      activeSync = null;
    });
  }

  return activeSync;
}
