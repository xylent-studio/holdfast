import { SCHEMA_VERSION } from '@/domain/constants';
import type {
  AttachmentRecord,
  DailyRecord,
  ItemRecord,
  ListItemRecord,
  ListRecord,
  RoutineRecord,
  SettingsRecord,
  WeeklyRecord,
} from '@/domain/schemas/records';
import { getAttachmentDownload } from '@/storage/local/api';
import { db } from '@/storage/local/db';

export interface WorkspaceBackupSummary {
  attachmentCount: number;
  dayCount: number;
  itemCount: number;
  listCount: number;
  listItemCount: number;
  routineCount: number;
  weekCount: number;
}

export interface WorkspaceBackupAttachment {
  dataUrl: string;
  record: AttachmentRecord;
}

export interface WorkspaceBackupFile {
  appSchemaVersion: typeof SCHEMA_VERSION;
  attachments: WorkspaceBackupAttachment[];
  dailyRecords: DailyRecord[];
  exportedAt: string;
  format: 'holdfast-backup';
  items: ItemRecord[];
  listItems: ListItemRecord[];
  lists: ListRecord[];
  routines: RoutineRecord[];
  settings: SettingsRecord | null;
  summary: WorkspaceBackupSummary;
  version: 1;
  weeklyRecords: WeeklyRecord[];
}

export interface WorkspaceBackupExport {
  backup: WorkspaceBackupFile;
  blob: Blob;
  filename: string;
}

function compareByCreatedAt<T extends { createdAt: string; id: string }>(
  left: T,
  right: T,
): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function compareByDate<T extends { date: string }>(
  left: T,
  right: T,
): number {
  return left.date.localeCompare(right.date);
}

function compareByWeekStart<T extends { weekStart: string }>(
  left: T,
  right: T,
): number {
  return left.weekStart.localeCompare(right.weekStart);
}

function compareListItems(
  left: ListItemRecord,
  right: ListItemRecord,
): number {
  return (
    left.listId.localeCompare(right.listId) ||
    left.position - right.position ||
    left.id.localeCompare(right.id)
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function blobToDataUrl(blob: Blob, mimeType: string): Promise<string> {
  const bytes = new Uint8Array(
    typeof blob.arrayBuffer === 'function'
      ? await blob.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () =>
            reject(reader.error ?? new Error("Couldn't read the attachment."));
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.readAsArrayBuffer(blob);
        }),
  );
  const type = mimeType || blob.type || 'application/octet-stream';
  return `data:${type};base64,${bytesToBase64(bytes)}`;
}

function buildBackupSummary(
  items: ItemRecord[],
  lists: ListRecord[],
  listItems: ListItemRecord[],
  dailyRecords: DailyRecord[],
  weeklyRecords: WeeklyRecord[],
  routines: RoutineRecord[],
  attachments: WorkspaceBackupAttachment[],
): WorkspaceBackupSummary {
  return {
    attachmentCount: attachments.length,
    dayCount: dailyRecords.length,
    itemCount: items.length,
    listCount: lists.length,
    listItemCount: listItems.length,
    routineCount: routines.length,
    weekCount: weeklyRecords.length,
  };
}

export function workspaceBackupFilename(exportedAt: string): string {
  return `holdfast-backup-${exportedAt.slice(0, 10)}.json`;
}

export async function createWorkspaceBackup(): Promise<WorkspaceBackupFile> {
  const [
    itemRows,
    listRows,
    listItemRows,
    dailyRecords,
    weeklyRecords,
    routineRows,
    settings,
    attachmentRows,
  ] = await Promise.all([
    db.items.toArray(),
    db.lists.toArray(),
    db.listItems.toArray(),
    db.dailyRecords.toArray(),
    db.weeklyRecords.toArray(),
    db.routines.toArray(),
    db.settings.get('settings'),
    db.attachments.toArray(),
  ]);

  const items = itemRows
    .filter((item) => !item.deletedAt)
    .sort(compareByCreatedAt);
  const lists = listRows
    .filter((list) => !list.deletedAt)
    .sort(compareByCreatedAt);
  const activeItemIds = new Set(items.map((item) => item.id));
  const activeListIds = new Set(lists.map((list) => list.id));
  const listItems = listItemRows
    .filter(
      (listItem) => !listItem.deletedAt && activeListIds.has(listItem.listId),
    )
    .sort(compareListItems);
  const routines = routineRows
    .filter((routine) => !routine.deletedAt)
    .sort(compareByCreatedAt);
  const activeAttachments = attachmentRows
    .filter(
      (attachment) =>
        !attachment.deletedAt && activeItemIds.has(attachment.itemId),
    )
    .sort(compareByCreatedAt);

  const attachments: WorkspaceBackupAttachment[] = [];
  for (const attachment of activeAttachments) {
    const payload = await getAttachmentDownload(attachment.id);
    if (!payload) {
      throw new Error(
        `Couldn't include attachment "${attachment.name}" in the backup yet.`,
      );
    }

    attachments.push({
      dataUrl: await blobToDataUrl(payload.blob, attachment.mimeType),
      record: attachment,
    });
  }

  const sortedDailyRecords = dailyRecords.sort(compareByDate);
  const sortedWeeklyRecords = weeklyRecords.sort(compareByWeekStart);
  const exportedAt = new Date().toISOString();

  return {
    appSchemaVersion: SCHEMA_VERSION,
    attachments,
    dailyRecords: sortedDailyRecords,
    exportedAt,
    format: 'holdfast-backup',
    items,
    listItems,
    lists,
    routines,
    settings: settings ?? null,
    summary: buildBackupSummary(
      items,
      lists,
      listItems,
      sortedDailyRecords,
      sortedWeeklyRecords,
      routines,
      attachments,
    ),
    version: 1,
    weeklyRecords: sortedWeeklyRecords,
  };
}

export async function createWorkspaceBackupExport():
  Promise<WorkspaceBackupExport> {
  const backup = await createWorkspaceBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });

  return {
    backup,
    blob,
    filename: workspaceBackupFilename(backup.exportedAt),
  };
}
