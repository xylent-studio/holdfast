import Dexie, { type Table } from 'dexie';

import type {
  AttachmentBlobRecord,
  AttachmentRecord,
  DailyRecord,
  ItemRecord,
  ListItemRecord,
  ListRecord,
  MutationRecord,
  PrototypeRecoverySessionRecord,
  RoutineRecord,
  SettingsRecord,
  SyncStateRecord,
  WorkspaceStateRecord,
  WorkspaceRestoreSessionRecord,
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
  prototypeRecoverySessions!: Table<PrototypeRecoverySessionRecord, string>;
  workspaceRestoreSessions!: Table<WorkspaceRestoreSessionRecord, string>;
  syncState!: Table<SyncStateRecord, string>;
  workspaceState!: Table<WorkspaceStateRecord, string>;

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

    this.version(3).stores({
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
      prototypeRecoverySessions: 'id, createdAt, undoneAt',
      syncState: 'id, updatedAt',
    });

    this.version(4).stores({
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
      prototypeRecoverySessions: 'id, createdAt, undoneAt',
      workspaceRestoreSessions: 'id, createdAt, undoneAt',
      syncState: 'id, updatedAt',
    });

    this.version(5)
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
        prototypeRecoverySessions: 'id, createdAt, undoneAt',
        workspaceRestoreSessions: 'id, createdAt, undoneAt',
        syncState: 'id, updatedAt',
        workspaceState: 'id, updatedAt',
      })
      .upgrade(async (tx) => {
        const addRemoteRevision = async (tableName: string): Promise<void> => {
          await tx
            .table(tableName)
            .toCollection()
            .modify((record: Record<string, unknown>) => {
              record.schemaVersion = 3;
              record.remoteRevision ??= null;
            });
        };

        await addRemoteRevision('items');
        await addRemoteRevision('lists');
        await addRemoteRevision('listItems');
        await addRemoteRevision('dailyRecords');
        await addRemoteRevision('weeklyRecords');
        await addRemoteRevision('routines');
        await addRemoteRevision('settings');
        await addRemoteRevision('attachments');

        await tx
          .table('attachmentBlobs')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 3;
          });
        await tx
          .table('mutationQueue')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 3;
          });
        await tx
          .table('prototypeRecoverySessions')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 3;
          });
        await tx
          .table('workspaceRestoreSessions')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 3;
          });
        await tx
          .table('syncState')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.schemaVersion = 3;
          });
      });

    this.version(6)
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
        prototypeRecoverySessions: 'id, createdAt, undoneAt',
        workspaceRestoreSessions: 'id, createdAt, undoneAt',
        syncState: 'id, updatedAt',
        workspaceState: 'id, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('syncState')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.pullCursorByStream ??= {
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
          });
      });
  }
}

export const db = new HoldfastDatabase();
