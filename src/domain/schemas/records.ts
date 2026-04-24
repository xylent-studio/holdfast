import { z } from 'zod';

import { SCHEMA_VERSION } from '@/domain/constants';

const schemaVersion = z.literal(SCHEMA_VERSION);

export const LaneSchema = z.enum([
  'work',
  'health',
  'home',
  'people',
  'build',
  'admin',
]);
export const ItemKindSchema = z.enum(['capture', 'task', 'note']);
export const ItemStatusSchema = z.enum([
  'inbox',
  'today',
  'upcoming',
  'waiting',
  'done',
  'archived',
]);
export const CaptureModeSchema = z.enum(['uncertain', 'direct', 'context']);
export const ListKindSchema = z.enum([
  'replenishment',
  'checklist',
  'project',
  'reference',
]);
export const ListItemStatusSchema = z.enum(['open', 'done', 'archived']);
export const AttachmentKindSchema = z.enum(['image', 'audio', 'file']);
export const SyncRecordStateSchema = z.enum(['pending', 'synced', 'conflict']);
export const MutationStatusSchema = z.enum([
  'pending',
  'sent',
  'acknowledged',
  'failed',
]);
export const WorkspaceOwnershipStateSchema = z.enum([
  'device-guest',
  'member',
]);
export const SyncAuthPromptStateSchema = z.enum([
  'none',
  'session-expired',
  'signed-out-by-user',
  'account-mismatch',
]);
export const SyncBlockedReasonSchema = z.enum([
  'not-configured',
  'signed-out',
  'offline',
  'detached-restore',
  'account-mismatch',
]);
export const WorkspaceAttachStateSchema = z.enum([
  'attached',
  'detached-restore',
]);
export const SyncPullCursorSchema = z.object({
  updatedAt: z.string().nullable().default(null),
  id: z.string().nullable().default(null),
});
export const SyncPullCursorMapSchema = z.object({
  items: SyncPullCursorSchema,
  lists: SyncPullCursorSchema,
  listItems: SyncPullCursorSchema,
  dailyRecords: SyncPullCursorSchema,
  weeklyRecords: SyncPullCursorSchema,
  routines: SyncPullCursorSchema,
  settings: SyncPullCursorSchema,
  attachments: SyncPullCursorSchema,
  deletedRecords: SyncPullCursorSchema,
});
export const PrototypeRecoverySourceSchema = z.enum(['browser', 'file']);
export const ReadinessKeySchema = z.enum([
  'water',
  'food',
  'supplements',
  'hygiene',
  'movement',
  'sleepSetup',
]);

export const ItemRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion,
  title: z.string().min(1),
  kind: ItemKindSchema,
  lane: LaneSchema,
  status: ItemStatusSchema,
  body: z.string(),
  sourceText: z.string().nullable().default(null),
  sourceItemId: z.string().uuid().nullable().default(null),
  captureMode: CaptureModeSchema.nullable().default(null),
  sourceDate: z.string(),
  scheduledDate: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  routineId: z.string().uuid().nullable(),
  completedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  syncState: SyncRecordStateSchema,
  remoteRevision: z.string().nullable().default(null),
});

export const ListRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion,
  title: z.string().min(1),
  kind: ListKindSchema,
  lane: LaneSchema,
  pinned: z.boolean(),
  sourceItemId: z.string().uuid().nullable().default(null),
  scheduledDate: z.string().nullable().default(null),
  scheduledTime: z.string().nullable().default(null),
  completedAt: z.string().nullable().default(null),
  archivedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().default(null),
  syncState: SyncRecordStateSchema,
  remoteRevision: z.string().nullable().default(null),
});

export const ListItemRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion,
  listId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string(),
  status: ListItemStatusSchema,
  position: z.number().int().nonnegative(),
  sourceItemId: z.string().uuid().nullable().default(null),
  nowDate: z.string().nullable().default(null),
  completedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  syncState: SyncRecordStateSchema,
  remoteRevision: z.string().nullable().default(null),
});

export const DailyRecordSchema = z.object({
  date: z.string(),
  schemaVersion,
  startedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  readiness: z.object({
    water: z.boolean(),
    food: z.boolean(),
    supplements: z.boolean(),
    hygiene: z.boolean(),
    movement: z.boolean(),
    sleepSetup: z.boolean(),
  }),
  focusItemIds: z.array(z.string().uuid()),
  focusListIds: z.array(z.string().uuid()).default([]),
  launchNote: z.string(),
  closeWin: z.string(),
  closeCarry: z.string(),
  closeSeed: z.string(),
  closeNote: z.string(),
  seededRoutineIds: z.array(z.string().uuid()),
  createdAt: z.string(),
  updatedAt: z.string(),
  syncState: SyncRecordStateSchema,
  remoteRevision: z.string().nullable().default(null),
});

export const WeeklyRecordSchema = z.object({
  weekStart: z.string(),
  schemaVersion,
  focus: z.string(),
  protect: z.string(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  syncState: SyncRecordStateSchema,
  remoteRevision: z.string().nullable().default(null),
});

export const RoutineRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion,
  title: z.string().min(1),
  lane: LaneSchema,
  destination: z.enum(['today', 'upcoming']),
  weekdays: z.array(z.number().int().min(0).max(6)),
  scheduledTime: z.string().nullable(),
  notes: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  syncState: SyncRecordStateSchema,
  remoteRevision: z.string().nullable().default(null),
});

export const SettingsRecordSchema = z.object({
  id: z.literal('settings'),
  schemaVersion,
  direction: z.string(),
  standards: z.string(),
  why: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  syncState: SyncRecordStateSchema,
  remoteRevision: z.string().nullable().default(null),
});

export const AttachmentRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion,
  itemId: z.string().uuid(),
  blobId: z.string().uuid(),
  kind: AttachmentKindSchema,
  name: z.string().min(1),
  mimeType: z.string(),
  size: z.number().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  syncState: SyncRecordStateSchema,
  remoteRevision: z.string().nullable().default(null),
});

export const AttachmentBlobRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion,
  blob: z.instanceof(Blob),
  createdAt: z.string(),
});

export const MutationRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion,
  entity: z.enum([
    'item',
    'list',
    'listItem',
    'dailyRecord',
    'weeklyRecord',
    'routine',
    'settings',
    'attachment',
  ]),
  entityId: z.string(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  status: MutationStatusSchema,
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
});

export const SyncStateRecordSchema = z.object({
  id: z.literal('sync'),
  schemaVersion,
  provider: z.enum(['supabase']),
  mode: z.enum(['disabled', 'ready', 'syncing', 'error']),
  lastSyncedAt: z.string().nullable(),
  blockedReason: SyncBlockedReasonSchema.nullable().default(null),
  lastTransportError: z.string().nullable().default(null),
  lastFailureAt: z.string().nullable().default(null),
  pullCursorByStream: SyncPullCursorMapSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WorkspaceStateRecordSchema = z.object({
  id: z.literal('workspace'),
  schemaVersion,
  ownershipState: WorkspaceOwnershipStateSchema.default('device-guest'),
  boundUserId: z.string().uuid().nullable().default(null),
  authPromptState: SyncAuthPromptStateSchema.default('none'),
  attachState: WorkspaceAttachStateSchema.default('attached'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const LegacyPrototypeSummarySchema = z.object({
  attachmentCount: z.number().int().nonnegative(),
  dayCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  noteCount: z.number().int().nonnegative(),
  routineCount: z.number().int().nonnegative(),
  taskCount: z.number().int().nonnegative(),
  weekCount: z.number().int().nonnegative(),
});

export const WorkspaceBackupSummarySchema = z.object({
  attachmentCount: z.number().int().nonnegative(),
  attachmentPayloadMissingCount: z.number().int().nonnegative(),
  dayCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  listCount: z.number().int().nonnegative(),
  listItemCount: z.number().int().nonnegative(),
  routineCount: z.number().int().nonnegative(),
  weekCount: z.number().int().nonnegative(),
});

export const PrototypeRecoverySessionRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion,
  source: PrototypeRecoverySourceSchema,
  createdAt: z.string(),
  undoneAt: z.string().nullable(),
  summary: LegacyPrototypeSummarySchema,
  createdItemIds: z.array(z.string().uuid()),
  createdRoutineIds: z.array(z.string().uuid()),
  createdAttachmentIds: z.array(z.string().uuid()),
  createdAttachmentBlobIds: z.array(z.string().uuid()),
  createdDailyRecordDates: z.array(z.string()),
  createdWeeklyRecordDates: z.array(z.string()),
  previousDailyRecords: z.array(DailyRecordSchema),
  previousWeeklyRecords: z.array(WeeklyRecordSchema),
  previousSettings: SettingsRecordSchema.nullable(),
});

export const WorkspaceRestoreSessionRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion,
  createdAt: z.string(),
  undoneAt: z.string().nullable(),
  restoredSummary: WorkspaceBackupSummarySchema,
  previousBackupJson: z.string().min(1),
});

export type Lane = z.infer<typeof LaneSchema>;
export type ItemKind = z.infer<typeof ItemKindSchema>;
export type ItemStatus = z.infer<typeof ItemStatusSchema>;
export type CaptureMode = z.infer<typeof CaptureModeSchema>;
export type ListKind = z.infer<typeof ListKindSchema>;
export type ListItemStatus = z.infer<typeof ListItemStatusSchema>;
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>;
export type SyncRecordState = z.infer<typeof SyncRecordStateSchema>;
export type WorkspaceOwnershipState = z.infer<
  typeof WorkspaceOwnershipStateSchema
>;
export type SyncAuthPromptState = z.infer<typeof SyncAuthPromptStateSchema>;
export type SyncBlockedReason = z.infer<typeof SyncBlockedReasonSchema>;
export type WorkspaceAttachState = z.infer<typeof WorkspaceAttachStateSchema>;
export type SyncPullCursor = z.infer<typeof SyncPullCursorSchema>;
export type SyncPullCursorMap = z.infer<typeof SyncPullCursorMapSchema>;
export type PrototypeRecoverySource = z.infer<
  typeof PrototypeRecoverySourceSchema
>;
export type ReadinessKey = z.infer<typeof ReadinessKeySchema>;

export type ItemRecord = z.infer<typeof ItemRecordSchema>;
export type ListRecord = z.infer<typeof ListRecordSchema>;
export type ListItemRecord = z.infer<typeof ListItemRecordSchema>;
export type DailyRecord = z.infer<typeof DailyRecordSchema>;
export type WeeklyRecord = z.infer<typeof WeeklyRecordSchema>;
export type RoutineRecord = z.infer<typeof RoutineRecordSchema>;
export type SettingsRecord = z.infer<typeof SettingsRecordSchema>;
export type AttachmentRecord = z.infer<typeof AttachmentRecordSchema>;
export type AttachmentBlobRecord = z.infer<typeof AttachmentBlobRecordSchema>;
export type MutationRecord = z.infer<typeof MutationRecordSchema>;
export type SyncStateRecord = z.infer<typeof SyncStateRecordSchema>;
export type WorkspaceStateRecord = z.infer<typeof WorkspaceStateRecordSchema>;
export type LegacyPrototypeSummary = z.infer<
  typeof LegacyPrototypeSummarySchema
>;
export type WorkspaceBackupSummary = z.infer<
  typeof WorkspaceBackupSummarySchema
>;
export type PrototypeRecoverySessionRecord = z.infer<
  typeof PrototypeRecoverySessionRecordSchema
>;
export type WorkspaceRestoreSessionRecord = z.infer<
  typeof WorkspaceRestoreSessionRecordSchema
>;
