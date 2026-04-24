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

    this.version(7)
      .stores({
        items:
          'id, status, kind, lane, scheduledDate, updatedAt, routineId, sourceItemId, deletedAt',
        lists: 'id, kind, pinned, updatedAt, archivedAt, deletedAt',
        listItems: 'id, listId, status, position, nowDate, updatedAt, deletedAt',
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
        type LegacyItemRow = Record<string, unknown> & {
          id: string;
          title?: string;
          body?: string;
          sourceItemId?: string | null;
          status?: string;
          scheduledDate?: string | null;
          sourceDate?: string | null;
          completedAt?: string | null;
          archivedAt?: string | null;
          updatedAt?: string;
          deletedAt?: string | null;
          syncState?: string;
        };
        type LegacyListItemRow = Record<string, unknown> & {
          id: string;
          title?: string;
          body?: string;
          status?: string;
          completedAt?: string | null;
          archivedAt?: string | null;
          updatedAt?: string;
          promotedItemId?: string | null;
          nowDate?: string | null;
          syncState?: string;
        };

        const stampSchemaVersion = async (tableName: string): Promise<void> => {
          await tx
            .table(tableName)
            .toCollection()
            .modify((record: Record<string, unknown>) => {
              record.schemaVersion = 4;
            });
        };

        await Promise.all([
          stampSchemaVersion('items'),
          stampSchemaVersion('lists'),
          stampSchemaVersion('listItems'),
          stampSchemaVersion('dailyRecords'),
          stampSchemaVersion('weeklyRecords'),
          stampSchemaVersion('routines'),
          stampSchemaVersion('settings'),
          stampSchemaVersion('attachments'),
          stampSchemaVersion('attachmentBlobs'),
          stampSchemaVersion('mutationQueue'),
          stampSchemaVersion('prototypeRecoverySessions'),
          stampSchemaVersion('workspaceRestoreSessions'),
          stampSchemaVersion('syncState'),
          stampSchemaVersion('workspaceState'),
        ]);

        const [items, listItems] = await Promise.all([
          tx.table('items').toArray() as Promise<LegacyItemRow[]>,
          tx.table('listItems').toArray() as Promise<LegacyListItemRow[]>,
        ]);
        const itemById = new Map(items.map((item) => [item.id, item]));
        const migrationTimestamp = new Date().toISOString();

        const migratedListItems = listItems.map((listItem) => {
          const promotedItemId =
            typeof listItem.promotedItemId === 'string'
              ? listItem.promotedItemId
              : null;
          const promotedItem = promotedItemId
            ? itemById.get(promotedItemId) ?? null
            : null;
          const promotedUpdatedAt = promotedItem?.updatedAt ?? '';
          const listItemUpdatedAt = listItem.updatedAt ?? '';
          const promotedIsNewer =
            Boolean(promotedUpdatedAt) &&
            promotedUpdatedAt.localeCompare(listItemUpdatedAt) > 0;
          const projectedStatus =
            promotedItem?.status === 'done'
              ? 'done'
              : promotedItem?.status === 'today'
                ? 'open'
                : null;
          const needsConflict =
            Boolean(promotedItem) &&
            projectedStatus === null &&
            promotedItem?.status !== 'archived';

          return {
            ...listItem,
            title:
              promotedIsNewer && promotedItem?.title
                ? promotedItem.title
                : (listItem.title ?? ''),
            body:
              promotedIsNewer && promotedItem?.body !== undefined
                ? promotedItem.body
                : (listItem.body ?? ''),
            status:
              projectedStatus && promotedIsNewer
                ? projectedStatus
                : (listItem.status ?? 'open'),
            nowDate:
              promotedItem?.status === 'today'
                ? promotedItem.scheduledDate ?? promotedItem.sourceDate ?? null
                : (listItem.nowDate ?? null),
            completedAt:
              projectedStatus === 'done' && promotedIsNewer
                ? promotedItem?.completedAt ?? listItem.completedAt ?? null
                : (listItem.completedAt ?? null),
            updatedAt:
              promotedIsNewer && promotedUpdatedAt
                ? promotedUpdatedAt
                : (listItem.updatedAt ?? migrationTimestamp),
            syncState:
              needsConflict || promotedItem?.syncState === 'conflict'
                ? 'conflict'
                : (listItem.syncState ?? 'pending'),
            promotedItemId: undefined,
            schemaVersion: 4,
          };
        });

        const archivedProjectionItems = items.map((item) => {
          const sourceListItem = listItems.find(
            (listItem) => listItem.promotedItemId === item.id,
          );
          if (!sourceListItem) {
            return item;
          }

          return {
            ...item,
            status: 'archived',
            archivedAt:
              typeof item.archivedAt === 'string'
                ? item.archivedAt
                : migrationTimestamp,
            updatedAt: migrationTimestamp,
            schemaVersion: 4,
          };
        });

        await Promise.all([
          tx.table('listItems').bulkPut(migratedListItems),
          tx.table('items').bulkPut(archivedProjectionItems),
        ]);
      });

    this.version(8)
      .stores({
        items:
          'id, status, kind, lane, scheduledDate, updatedAt, routineId, sourceItemId, deletedAt',
        lists:
          'id, kind, pinned, scheduledDate, updatedAt, archivedAt, deletedAt',
        listItems: 'id, listId, status, position, nowDate, updatedAt, deletedAt',
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
        const stampSchemaVersion = async (tableName: string): Promise<void> => {
          await tx
            .table(tableName)
            .toCollection()
            .modify((record: Record<string, unknown>) => {
              record.schemaVersion = 5;
            });
        };

        await Promise.all([
          stampSchemaVersion('items'),
          stampSchemaVersion('lists'),
          stampSchemaVersion('listItems'),
          stampSchemaVersion('dailyRecords'),
          stampSchemaVersion('weeklyRecords'),
          stampSchemaVersion('routines'),
          stampSchemaVersion('settings'),
          stampSchemaVersion('attachments'),
          stampSchemaVersion('attachmentBlobs'),
          stampSchemaVersion('mutationQueue'),
          stampSchemaVersion('prototypeRecoverySessions'),
          stampSchemaVersion('workspaceRestoreSessions'),
          stampSchemaVersion('syncState'),
          stampSchemaVersion('workspaceState'),
        ]);

        await tx
          .table('lists')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.scheduledDate ??= null;
            record.scheduledTime ??= null;
            record.completedAt ??= null;
          });

        await tx
          .table('dailyRecords')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            record.focusListIds ??= [];
          });
      });

    this.version(9)
      .stores({
        items:
          'id, status, kind, lane, scheduledDate, updatedAt, routineId, sourceItemId, deletedAt',
        lists:
          'id, kind, pinned, scheduledDate, updatedAt, archivedAt, deletedAt',
        listItems: 'id, listId, status, position, nowDate, updatedAt, deletedAt',
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
            record.schemaVersion = 5;
            record.blockedReason ??=
              record.mode === 'disabled' ? 'not-configured' : 'signed-out';
            record.lastFailureAt ??= null;
            record.lastTransportError ??= null;
          });
      });
  }
}

export const db = new HoldfastDatabase();
