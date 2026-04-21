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
  type SyncRecordState,
  type WeeklyRecord,
} from '@/domain/schemas/records';
import {
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

function syncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Couldn't sync yet.";
}

function isDeletedMutation(mutation: MutationRecord): boolean {
  return mutation.type.endsWith('.deleted');
}

function syncStateForRemoteWrite(
  current: SyncRecordState,
  expectedUpdatedAt: string,
  rowUpdatedAt: string,
): SyncRecordState {
  if (current === 'conflict') {
    return current;
  }

  return expectedUpdatedAt === rowUpdatedAt ? 'synced' : current;
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

async function deleteLocalListCascade(listId: string): Promise<void> {
  const listItems = await db.listItems.where('listId').equals(listId).toArray();
  await db.lists.delete(listId);
  await db.listItems.bulkDelete(listItems.map((listItem) => listItem.id));
}

async function getLocalEntityRecord(
  entity: MutationRecord['entity'],
  entityId: string,
): Promise<
  | ItemRecord
  | ListRecord
  | ListItemRecord
  | DailyRecord
  | WeeklyRecord
  | RoutineRecord
  | SettingsRecord
  | AttachmentRecord
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

async function markLocalEntitySynced(
  entity: MutationRecord['entity'],
  entityId: string,
  expectedUpdatedAt: string | null,
): Promise<void> {
  const current = await getLocalEntityRecord(entity, entityId);
  if (!current) {
    return;
  }

  const nextSyncState =
    expectedUpdatedAt && 'updatedAt' in current
      ? syncStateForRemoteWrite(
          current.syncState,
          expectedUpdatedAt,
          current.updatedAt,
        )
      : 'synced';

  switch (entity) {
    case 'item':
      await db.items.put({
        ...current,
        syncState: nextSyncState,
      });
      return;
    case 'list':
      await db.lists.put({
        ...current,
        syncState: nextSyncState,
      });
      return;
    case 'listItem':
      await db.listItems.put({
        ...current,
        syncState: nextSyncState,
      });
      return;
    case 'dailyRecord':
      await db.dailyRecords.put({
        ...current,
        syncState: nextSyncState,
      });
      return;
    case 'weeklyRecord':
      await db.weeklyRecords.put({
        ...current,
        syncState: nextSyncState,
      });
      return;
    case 'routine':
      await db.routines.put({
        ...current,
        syncState: nextSyncState,
      });
      return;
    case 'settings':
      await db.settings.put({
        ...current,
        syncState: nextSyncState,
      });
      return;
    case 'attachment':
      await db.attachments.put({
        ...current,
        syncState: nextSyncState,
      });
  }
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
): Promise<{ updatedAt: string } | null> {
  switch (entity) {
    case 'item': {
      const { data, error } = await client
        .from('items')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote item state.");
      }
      return data ? { updatedAt: String(data.updated_at) } : null;
    }
    case 'list': {
      const { data, error } = await client
        .from('lists')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote list state.");
      }
      return data ? { updatedAt: String(data.updated_at) } : null;
    }
    case 'listItem': {
      const { data, error } = await client
        .from('list_items')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote list item state.");
      }
      return data ? { updatedAt: String(data.updated_at) } : null;
    }
    case 'dailyRecord': {
      const { data, error } = await client
        .from('daily_records')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('date', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote day state.");
      }
      return data ? { updatedAt: String(data.updated_at) } : null;
    }
    case 'weeklyRecord': {
      const { data, error } = await client
        .from('weekly_records')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('week_start', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote week state.");
      }
      return data ? { updatedAt: String(data.updated_at) } : null;
    }
    case 'routine': {
      const { data, error } = await client
        .from('routines')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote routine state.");
      }
      return data ? { updatedAt: String(data.updated_at) } : null;
    }
    case 'settings': {
      const { data, error } = await client
        .from('settings')
        .select('updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote settings.");
      }
      return data ? { updatedAt: String(data.updated_at) } : null;
    }
    case 'attachment': {
      const { data, error } = await client
        .from('attachments')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('id', entityId)
        .maybeSingle();
      if (error) {
        throw new Error("Couldn't read remote attachment state.");
      }
      return data ? { updatedAt: String(data.updated_at) } : null;
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

  if ('updatedAt' in current) {
    const remoteExisting = await fetchRemoteExisting(
      client,
      userId,
      mutation.entity,
      mutation.entityId,
    );
    if (remoteExisting && remoteExisting.updatedAt > current.updatedAt) {
      await markLocalEntitySynced(mutation.entity, mutation.entityId, null);
      return;
    }
  }

  switch (mutation.entity) {
    case 'item': {
      const { error } = await client
        .from('items')
        .upsert(toRemoteItemRow(userId, current as ItemRecord));
      if (error) {
        throw new Error("Couldn't sync the item yet.");
      }
      await clearDeletedRecord(client, userId, 'item', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        current.updatedAt,
      );
      return;
    }
    case 'list': {
      const { error } = await client
        .from('lists')
        .upsert(toRemoteListRow(userId, current as ListRecord));
      if (error) {
        throw new Error("Couldn't sync the list yet.");
      }
      await clearDeletedRecord(client, userId, 'list', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        current.updatedAt,
      );
      return;
    }
    case 'listItem': {
      const { error } = await client
        .from('list_items')
        .upsert(toRemoteListItemRow(userId, current as ListItemRecord));
      if (error) {
        throw new Error("Couldn't sync the list item yet.");
      }
      await clearDeletedRecord(client, userId, 'listItem', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        current.updatedAt,
      );
      return;
    }
    case 'dailyRecord': {
      const { error } = await client
        .from('daily_records')
        .upsert(toRemoteDailyRecordRow(userId, current as DailyRecord), {
          onConflict: 'user_id,date',
        });
      if (error) {
        throw new Error("Couldn't sync the day yet.");
      }
      await clearDeletedRecord(client, userId, 'dailyRecord', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        current.updatedAt,
      );
      return;
    }
    case 'weeklyRecord': {
      const { error } = await client
        .from('weekly_records')
        .upsert(toRemoteWeeklyRecordRow(userId, current as WeeklyRecord), {
          onConflict: 'user_id,week_start',
        });
      if (error) {
        throw new Error("Couldn't sync the week yet.");
      }
      await clearDeletedRecord(client, userId, 'weeklyRecord', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        current.updatedAt,
      );
      return;
    }
    case 'routine': {
      const { error } = await client
        .from('routines')
        .upsert(toRemoteRoutineRow(userId, current as RoutineRecord));
      if (error) {
        throw new Error("Couldn't sync the routine yet.");
      }
      await clearDeletedRecord(client, userId, 'routine', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        current.updatedAt,
      );
      return;
    }
    case 'settings': {
      const { error } = await client
        .from('settings')
        .upsert(toRemoteSettingsRow(userId, current as SettingsRecord), {
          onConflict: 'user_id',
        });
      if (error) {
        throw new Error("Couldn't sync settings yet.");
      }
      await clearDeletedRecord(client, userId, 'settings', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        current.updatedAt,
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
      const { error } = await client
        .from('attachments')
        .upsert(toRemoteAttachmentRow(userId, attachment));
      if (error) {
        throw new Error("Couldn't sync the attachment yet.");
      }
      await clearDeletedRecord(client, userId, 'attachment', mutation.entityId);
      await markLocalEntitySynced(
        mutation.entity,
        mutation.entityId,
        attachment.updatedAt,
      );
    }
  }
}

async function processDeletionMutation(
  client: SupabaseClient,
  userId: string,
  mutation: MutationRecord,
): Promise<void> {
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
): Promise<void> {
  const pendingMutations = (await db.mutationQueue.toArray())
    .filter(
      (mutation) =>
        mutation.status === 'pending' || mutation.status === 'failed',
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

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
      await markMutationStatus(mutation.id, {
        status: 'failed',
        lastError: syncErrorMessage(error),
      });
      throw error;
    }
  }
}

async function putRemoteAttachmentRow(row: RemoteAttachmentRow): Promise<void> {
  const current = await db.attachments.get(row.id);
  if (
    current &&
    current.syncState === 'pending' &&
    current.updatedAt > row.updated_at
  ) {
    return;
  }

  const nextAttachment = fromRemoteAttachmentRow(row);
  await db.attachments.put({
    ...nextAttachment,
    blobId: current?.blobId ?? nextAttachment.blobId,
  });
  await acknowledgeEntityMutations('attachment', row.id);
}

async function putRemoteItemRow(row: RemoteItemRow): Promise<void> {
  const current = await db.items.get(row.id);
  if (
    current &&
    current.syncState === 'pending' &&
    current.updatedAt > row.updated_at
  ) {
    return;
  }

  await db.items.put(fromRemoteItemRow(row));
  await acknowledgeEntityMutations('item', row.id);
}

async function putRemoteListRow(row: RemoteListRow): Promise<void> {
  const current = await db.lists.get(row.id);
  if (
    current &&
    current.syncState === 'pending' &&
    current.updatedAt > row.updated_at
  ) {
    return;
  }

  await db.lists.put(fromRemoteListRow(row));
  await acknowledgeEntityMutations('list', row.id);
}

async function putRemoteListItemRow(row: RemoteListItemRow): Promise<void> {
  const current = await db.listItems.get(row.id);
  if (
    current &&
    current.syncState === 'pending' &&
    current.updatedAt > row.updated_at
  ) {
    return;
  }

  await db.listItems.put(fromRemoteListItemRow(row));
  await acknowledgeEntityMutations('listItem', row.id);
}

async function putRemoteDailyRecordRow(row: RemoteDailyRecordRow): Promise<void> {
  const current = await db.dailyRecords.get(row.date);
  if (
    current &&
    current.syncState === 'pending' &&
    current.updatedAt > row.updated_at
  ) {
    return;
  }

  await db.dailyRecords.put(fromRemoteDailyRecordRow(row));
  await acknowledgeEntityMutations('dailyRecord', row.date);
}

async function putRemoteWeeklyRecordRow(
  row: RemoteWeeklyRecordRow,
): Promise<void> {
  const current = await db.weeklyRecords.get(row.week_start);
  if (
    current &&
    current.syncState === 'pending' &&
    current.updatedAt > row.updated_at
  ) {
    return;
  }

  await db.weeklyRecords.put(fromRemoteWeeklyRecordRow(row));
  await acknowledgeEntityMutations('weeklyRecord', row.week_start);
}

async function putRemoteRoutineRow(row: RemoteRoutineRow): Promise<void> {
  const current = await db.routines.get(row.id);
  if (
    current &&
    current.syncState === 'pending' &&
    current.updatedAt > row.updated_at
  ) {
    return;
  }

  await db.routines.put(fromRemoteRoutineRow(row));
  await acknowledgeEntityMutations('routine', row.id);
}

async function putRemoteSettingsRow(row: RemoteSettingsRow): Promise<void> {
  const current = await db.settings.get('settings');
  if (
    current &&
    current.syncState === 'pending' &&
    current.updatedAt > row.updated_at
  ) {
    return;
  }

  await db.settings.put(fromRemoteSettingsRow(row));
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
        current &&
        current.syncState === 'pending' &&
        current.updatedAt > deletedAt
      ) {
        return;
      }

      await deleteLocalItemCascade(recordId);
      await acknowledgeEntityMutations('item', recordId);
      return;
    }
    case 'list': {
      const current = await db.lists.get(recordId);
      if (
        current &&
        current.syncState === 'pending' &&
        current.updatedAt > deletedAt
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
        current &&
        current.syncState === 'pending' &&
        current.updatedAt > deletedAt
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
        current &&
        current.syncState === 'pending' &&
        current.updatedAt > deletedAt
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
        current &&
        current.syncState === 'pending' &&
        current.updatedAt > deletedAt
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

async function fetchRemoteRows<T extends { server_updated_at?: string }>(
  client: SupabaseClient,
  userId: string,
  table: string,
  since: string | null,
): Promise<T[]> {
  let query = client
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('server_updated_at', {
      ascending: true,
    });

  if (since) {
    query = query.gt('server_updated_at', since);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Couldn't pull the latest changes yet.");
  }

  return (data ?? []) as T[];
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
  lastSyncedAt: string | null,
): Promise<string> {
  const baseline = lastSyncedAt ?? nowIso();
  const [
    items,
    lists,
    listItems,
    dailyRecords,
    weeklyRecords,
    routines,
    settings,
    attachments,
    deletedRecords,
  ] = await Promise.all([
    fetchRemoteRows<RemoteItemRow>(client, userId, 'items', lastSyncedAt),
    fetchRemoteRows<RemoteListRow>(client, userId, 'lists', lastSyncedAt),
    fetchRemoteRows<RemoteListItemRow>(client, userId, 'list_items', lastSyncedAt),
    fetchRemoteRows<RemoteDailyRecordRow>(client, userId, 'daily_records', lastSyncedAt),
    fetchRemoteRows<RemoteWeeklyRecordRow>(
      client,
      userId,
      'weekly_records',
      lastSyncedAt,
    ),
    fetchRemoteRows<RemoteRoutineRow>(client, userId, 'routines', lastSyncedAt),
    fetchRemoteRows<RemoteSettingsRow>(client, userId, 'settings', lastSyncedAt),
    fetchRemoteRows<RemoteAttachmentRow>(client, userId, 'attachments', lastSyncedAt),
    fetchRemoteRows<RemoteDeletedRecordRow>(
      client,
      userId,
      'deleted_records',
      lastSyncedAt,
    ),
  ]);

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

  return nextWatermark(baseline, [
    ...items.map((row) => row.server_updated_at),
    ...lists.map((row) => row.server_updated_at),
    ...listItems.map((row) => row.server_updated_at),
    ...dailyRecords.map((row) => row.server_updated_at),
    ...weeklyRecords.map((row) => row.server_updated_at),
    ...routines.map((row) => row.server_updated_at),
    ...settings.map((row) => row.server_updated_at),
    ...attachments.map((row) => row.server_updated_at),
    ...deletedRecords.map((row) => row.server_updated_at),
  ]);
}

async function runSync(client: SupabaseClient, userId: string): Promise<void> {
  const syncState = await getCurrentSyncState();
  await updateSyncState({ mode: 'syncing' });

  try {
    await pushPendingMutations(client, userId);
    const lastSyncedAt = await pullRemoteChanges(
      client,
      userId,
      syncState.lastSyncedAt,
    );
    await updateSyncState({
      lastSyncedAt,
      mode: 'ready',
    });
  } catch (error) {
    await updateSyncState({ mode: 'error' });
    throw error;
  }
}

export async function syncHoldfastWithSupabase(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.user?.id) {
    return;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  if (!activeSync) {
    activeSync = runSync(client, session.user.id).finally(() => {
      activeSync = null;
    });
  }

  return activeSync;
}
