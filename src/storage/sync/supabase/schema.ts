import {
  AttachmentRecordSchema,
  DailyRecordSchema,
  ItemRecordSchema,
  ListItemRecordSchema,
  ListRecordSchema,
  RoutineRecordSchema,
  SettingsRecordSchema,
  WeeklyRecordSchema,
  type AttachmentRecord,
  type DailyRecord,
  type ItemRecord,
  type ListItemRecord,
  type ListRecord,
  type RoutineRecord,
  type SettingsRecord,
  type WeeklyRecord,
} from '@/domain/schemas/records';

export const HOLDFAST_ATTACHMENTS_BUCKET = 'holdfast-attachments';

export type SyncEntity =
  | 'item'
  | 'list'
  | 'listItem'
  | 'dailyRecord'
  | 'weeklyRecord'
  | 'routine'
  | 'settings'
  | 'attachment';

export interface RemoteItemRow {
  user_id: string;
  id: string;
  schema_version: number;
  title: string;
  kind: ItemRecord['kind'];
  lane: ItemRecord['lane'];
  status: ItemRecord['status'];
  body: string;
  source_text: string | null;
  source_item_id: string | null;
  capture_mode: ItemRecord['captureMode'];
  source_date: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  routine_id: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at?: string;
}

export interface RemoteListRow {
  user_id: string;
  id: string;
  schema_version: number;
  title: string;
  kind: ListRecord['kind'];
  lane: ListRecord['lane'];
  pinned: boolean;
  source_item_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at?: string;
}

export interface RemoteListItemRow {
  user_id: string;
  id: string;
  schema_version: number;
  list_id: string;
  title: string;
  body: string;
  status: ListItemRecord['status'];
  position: number;
  source_item_id: string | null;
  promoted_item_id: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at?: string;
}

export interface RemoteDailyRecordRow {
  user_id: string;
  date: string;
  schema_version: number;
  started_at: string | null;
  closed_at: string | null;
  readiness: DailyRecord['readiness'];
  focus_item_ids: string[];
  launch_note: string;
  close_win: string;
  close_carry: string;
  close_seed: string;
  close_note: string;
  seeded_routine_ids: string[];
  created_at: string;
  updated_at: string;
  server_updated_at?: string;
}

export interface RemoteWeeklyRecordRow {
  user_id: string;
  week_start: string;
  schema_version: number;
  focus: string;
  protect: string;
  notes: string;
  created_at: string;
  updated_at: string;
  server_updated_at?: string;
}

export interface RemoteRoutineRow {
  user_id: string;
  id: string;
  schema_version: number;
  title: string;
  lane: RoutineRecord['lane'];
  destination: RoutineRecord['destination'];
  weekdays: number[];
  scheduled_time: string | null;
  notes: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at?: string;
}

export interface RemoteSettingsRow {
  user_id: string;
  schema_version: number;
  direction: string;
  standards: string;
  why: string;
  created_at: string;
  updated_at: string;
  server_updated_at?: string;
}

export interface RemoteAttachmentRow {
  user_id: string;
  id: string;
  schema_version: number;
  item_id: string;
  kind: AttachmentRecord['kind'];
  name: string;
  mime_type: string;
  size: number;
  storage_path: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at?: string;
}

export interface RemoteDeletedRecordRow {
  user_id: string;
  entity: SyncEntity;
  record_id: string;
  deleted_at: string;
  server_updated_at?: string;
}

export function attachmentStoragePath(
  userId: string,
  attachmentId: string,
): string {
  return `${userId}/${attachmentId}`;
}

function remoteRevision(row: { server_updated_at?: string; updated_at?: string }): string | null {
  return row.server_updated_at ?? row.updated_at ?? null;
}

export function toRemoteItemRow(
  userId: string,
  item: ItemRecord,
): RemoteItemRow {
  return {
    user_id: userId,
    id: item.id,
    schema_version: item.schemaVersion,
    title: item.title,
    kind: item.kind,
    lane: item.lane,
    status: item.status,
    body: item.body,
    source_text: item.sourceText,
    source_item_id: item.sourceItemId,
    capture_mode: item.captureMode,
    source_date: item.sourceDate,
    scheduled_date: item.scheduledDate,
    scheduled_time: item.scheduledTime,
    routine_id: item.routineId,
    completed_at: item.completedAt,
    archived_at: item.archivedAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    deleted_at: item.deletedAt,
  };
}

export function fromRemoteItemRow(row: RemoteItemRow): ItemRecord {
  return ItemRecordSchema.parse({
    id: row.id,
    schemaVersion: row.schema_version,
    title: row.title,
    kind: row.kind,
    lane: row.lane,
    status: row.status,
    body: row.body,
    sourceText: row.source_text,
    sourceItemId: row.source_item_id,
    captureMode: row.capture_mode,
    sourceDate: row.source_date,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    routineId: row.routine_id,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncState: 'synced',
    remoteRevision: remoteRevision(row),
  });
}

export function toRemoteListRow(
  userId: string,
  list: ListRecord,
): RemoteListRow {
  return {
    user_id: userId,
    id: list.id,
    schema_version: list.schemaVersion,
    title: list.title,
    kind: list.kind,
    lane: list.lane,
    pinned: list.pinned,
    source_item_id: list.sourceItemId,
    archived_at: list.archivedAt,
    created_at: list.createdAt,
    updated_at: list.updatedAt,
    deleted_at: list.deletedAt,
  };
}

export function fromRemoteListRow(row: RemoteListRow): ListRecord {
  return ListRecordSchema.parse({
    id: row.id,
    schemaVersion: row.schema_version,
    title: row.title,
    kind: row.kind,
    lane: row.lane,
    pinned: row.pinned,
    sourceItemId: row.source_item_id,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncState: 'synced',
    remoteRevision: remoteRevision(row),
  });
}

export function toRemoteListItemRow(
  userId: string,
  listItem: ListItemRecord,
): RemoteListItemRow {
  return {
    user_id: userId,
    id: listItem.id,
    schema_version: listItem.schemaVersion,
    list_id: listItem.listId,
    title: listItem.title,
    body: listItem.body,
    status: listItem.status,
    position: listItem.position,
    source_item_id: listItem.sourceItemId,
    promoted_item_id: listItem.promotedItemId,
    completed_at: listItem.completedAt,
    archived_at: listItem.archivedAt,
    created_at: listItem.createdAt,
    updated_at: listItem.updatedAt,
    deleted_at: listItem.deletedAt,
  };
}

export function fromRemoteListItemRow(
  row: RemoteListItemRow,
): ListItemRecord {
  return ListItemRecordSchema.parse({
    id: row.id,
    schemaVersion: row.schema_version,
    listId: row.list_id,
    title: row.title,
    body: row.body,
    status: row.status,
    position: row.position,
    sourceItemId: row.source_item_id,
    promotedItemId: row.promoted_item_id,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncState: 'synced',
    remoteRevision: remoteRevision(row),
  });
}

export function toRemoteDailyRecordRow(
  userId: string,
  dailyRecord: DailyRecord,
): RemoteDailyRecordRow {
  return {
    user_id: userId,
    date: dailyRecord.date,
    schema_version: dailyRecord.schemaVersion,
    started_at: dailyRecord.startedAt,
    closed_at: dailyRecord.closedAt,
    readiness: dailyRecord.readiness,
    focus_item_ids: dailyRecord.focusItemIds,
    launch_note: dailyRecord.launchNote,
    close_win: dailyRecord.closeWin,
    close_carry: dailyRecord.closeCarry,
    close_seed: dailyRecord.closeSeed,
    close_note: dailyRecord.closeNote,
    seeded_routine_ids: dailyRecord.seededRoutineIds,
    created_at: dailyRecord.createdAt,
    updated_at: dailyRecord.updatedAt,
  };
}

export function fromRemoteDailyRecordRow(
  row: RemoteDailyRecordRow,
): DailyRecord {
  return DailyRecordSchema.parse({
    date: row.date,
    schemaVersion: row.schema_version,
    startedAt: row.started_at,
    closedAt: row.closed_at,
    readiness: row.readiness,
    focusItemIds: row.focus_item_ids,
    launchNote: row.launch_note,
    closeWin: row.close_win,
    closeCarry: row.close_carry,
    closeSeed: row.close_seed,
    closeNote: row.close_note,
    seededRoutineIds: row.seeded_routine_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncState: 'synced',
    remoteRevision: remoteRevision(row),
  });
}

export function toRemoteWeeklyRecordRow(
  userId: string,
  weeklyRecord: WeeklyRecord,
): RemoteWeeklyRecordRow {
  return {
    user_id: userId,
    week_start: weeklyRecord.weekStart,
    schema_version: weeklyRecord.schemaVersion,
    focus: weeklyRecord.focus,
    protect: weeklyRecord.protect,
    notes: weeklyRecord.notes,
    created_at: weeklyRecord.createdAt,
    updated_at: weeklyRecord.updatedAt,
  };
}

export function fromRemoteWeeklyRecordRow(
  row: RemoteWeeklyRecordRow,
): WeeklyRecord {
  return WeeklyRecordSchema.parse({
    weekStart: row.week_start,
    schemaVersion: row.schema_version,
    focus: row.focus,
    protect: row.protect,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncState: 'synced',
    remoteRevision: remoteRevision(row),
  });
}

export function toRemoteRoutineRow(
  userId: string,
  routine: RoutineRecord,
): RemoteRoutineRow {
  return {
    user_id: userId,
    id: routine.id,
    schema_version: routine.schemaVersion,
    title: routine.title,
    lane: routine.lane,
    destination: routine.destination,
    weekdays: routine.weekdays,
    scheduled_time: routine.scheduledTime,
    notes: routine.notes,
    active: routine.active,
    created_at: routine.createdAt,
    updated_at: routine.updatedAt,
    deleted_at: routine.deletedAt,
  };
}

export function fromRemoteRoutineRow(row: RemoteRoutineRow): RoutineRecord {
  return RoutineRecordSchema.parse({
    id: row.id,
    schemaVersion: row.schema_version,
    title: row.title,
    lane: row.lane,
    destination: row.destination,
    weekdays: row.weekdays,
    scheduledTime: row.scheduled_time,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncState: 'synced',
    remoteRevision: remoteRevision(row),
  });
}

export function toRemoteSettingsRow(
  userId: string,
  settings: SettingsRecord,
): RemoteSettingsRow {
  return {
    user_id: userId,
    schema_version: settings.schemaVersion,
    direction: settings.direction,
    standards: settings.standards,
    why: settings.why,
    created_at: settings.createdAt,
    updated_at: settings.updatedAt,
  };
}

export function fromRemoteSettingsRow(row: RemoteSettingsRow): SettingsRecord {
  return SettingsRecordSchema.parse({
    id: 'settings',
    schemaVersion: row.schema_version,
    direction: row.direction,
    standards: row.standards,
    why: row.why,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncState: 'synced',
    remoteRevision: remoteRevision(row),
  });
}

export function toRemoteAttachmentRow(
  userId: string,
  attachment: AttachmentRecord,
): RemoteAttachmentRow {
  return {
    user_id: userId,
    id: attachment.id,
    schema_version: attachment.schemaVersion,
    item_id: attachment.itemId,
    kind: attachment.kind,
    name: attachment.name,
    mime_type: attachment.mimeType,
    size: attachment.size,
    storage_path: attachmentStoragePath(userId, attachment.id),
    created_at: attachment.createdAt,
    updated_at: attachment.updatedAt,
    deleted_at: attachment.deletedAt,
  };
}

export function fromRemoteAttachmentRow(
  row: RemoteAttachmentRow,
): AttachmentRecord {
  return AttachmentRecordSchema.parse({
    id: row.id,
    schemaVersion: row.schema_version,
    itemId: row.item_id,
    blobId: row.id,
    kind: row.kind,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncState: 'synced',
    remoteRevision: remoteRevision(row),
  });
}
