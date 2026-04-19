import Dexie, { type Table } from 'dexie';

import type {
  AttachmentBlobRecord,
  AttachmentRecord,
  DailyRecord,
  ItemRecord,
  MutationRecord,
  RoutineRecord,
  SettingsRecord,
  SyncStateRecord,
  WeeklyRecord,
} from '@/domain/schemas/records';

export class HoldfastDatabase extends Dexie {
  items!: Table<ItemRecord, string>;
  dailyRecords!: Table<DailyRecord, string>;
  weeklyRecords!: Table<WeeklyRecord, string>;
  routines!: Table<RoutineRecord, string>;
  settings!: Table<SettingsRecord, string>;
  attachments!: Table<AttachmentRecord, string>;
  attachmentBlobs!: Table<AttachmentBlobRecord, string>;
  mutationQueue!: Table<MutationRecord, string>;
  syncState!: Table<SyncStateRecord, string>;

  constructor() {
    super('holdfast');

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
  }
}

export const db = new HoldfastDatabase();
