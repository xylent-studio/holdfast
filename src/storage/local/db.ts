import Dexie, { type Table } from 'dexie';

import type {
  AttachmentBlobRecord,
  AttachmentRecord,
  DailyRecord,
  ItemRecord,
  ListItemRecord,
  ListRecord,
  MutationRecord,
  RoutineRecord,
  SettingsRecord,
  SyncStateRecord,
  WeeklyRecord,
} from '@/domain/schemas/records';

export const HOLDFAST_DB_NAME = 'holdfast';

export class HoldfastDatabase extends Dexie {
  items!: Table<ItemRecord, string>;
  lists!: Table<ListRecord, string>;
  listItems!: Table<ListItemRecord, string>;
  dailyRecords!: Table<DailyRecord, string>;
  weeklyRecords!: Table<WeeklyRecord, string>;
  routines!: Table<RoutineRecord, string>;
  settings!: Table<SettingsRecord, string>;
  attachments!: Table<AttachmentRecord, string>;
  attachmentBlobs!: Table<AttachmentBlobRecord, string>;
  mutationQueue!: Table<MutationRecord, string>;
  syncState!: Table<SyncStateRecord, string>;

  constructor(name = HOLDFAST_DB_NAME) {
    super(name);

    this.version(1).stores({
      items: 'id, status, lane, scheduledDate, updatedAt, routineId, deletedAt',
      dailyRecords: 'date, updatedAt',
      weeklyRecords: 'weekStart, updatedAt',
      routines: 'id, active, updatedAt, deletedAt',
      settings: 'id, updatedAt',
      attachments: 'id, itemId, kind, updatedAt, deletedAt',
      attachmentBlobs: 'id, createdAt',
      mutationQueue: 'id, entity, entityId, status, createdAt',
      syncState: 'id, updatedAt',
    });

    this.version(2)
      .stores({
        items:
          'id, status, kind, lane, scheduledDate, updatedAt, routineId, sourceItemId, deletedAt',
        lists: 'id, kind, pinned, updatedAt, archivedAt, deletedAt',
        listItems:
          'id, listId, status, position, promotedItemId, updatedAt, deletedAt',
        dailyRecords: 'date, updatedAt',
        weeklyRecords: 'weekStart, updatedAt',
        routines: 'id, active, updatedAt, deletedAt',
        settings: 'id, updatedAt',
        attachments: 'id, itemId, kind, updatedAt, deletedAt',
        attachmentBlobs: 'id, createdAt',
        mutationQueue: 'id, entity, entityId, status, createdAt',
        syncState: 'id, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('items')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 2;
            record.sourceText ??= null;
            record.sourceItemId ??= null;
            record.captureMode ??= null;
          });
        await tx
          .table('dailyRecords')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 2;
          });
        await tx
          .table('weeklyRecords')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 2;
          });
        await tx
          .table('routines')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 2;
          });
        await tx
          .table('settings')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 2;
          });
        await tx
          .table('attachments')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 2;
          });
        await tx
          .table('attachmentBlobs')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 2;
          });
        await tx
          .table('mutationQueue')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 2;
          });
        await tx
          .table('syncState')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 2;
          });
      });
  }
}

export const db = new HoldfastDatabase();
