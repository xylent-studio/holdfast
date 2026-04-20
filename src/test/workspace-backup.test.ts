import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { downloadAttachmentBlob } = vi.hoisted(() => ({
  downloadAttachmentBlob:
    vi.fn<(userId: string, attachmentId: string) => Promise<Blob>>(),
}));

vi.mock('@/storage/sync/supabase/attachments', () => ({
  downloadAttachmentBlob,
}));

import type { DateKey } from '@/domain/dates';
import {
  addFilesToItem,
  createItem,
  createList,
  createListItem,
  createRoutine,
  toggleReadiness,
  updateRoutine,
  updateSettings,
  updateSyncState,
  updateWeeklyRecord,
} from '@/storage/local/api';
import { HOLDFAST_DB_NAME, db } from '@/storage/local/db';
import {
  createWorkspaceBackup,
  createWorkspaceBackupExport,
  workspaceBackupFilename,
} from '@/storage/local/workspace-backup';

const CURRENT_DATE = '2026-04-19' as DateKey;

async function resetLocalDatabase(): Promise<void> {
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
  await db.open();
}

beforeEach(async () => {
  downloadAttachmentBlob.mockReset();
  await resetLocalDatabase();
});

afterEach(async () => {
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
});

function collectSyncStateKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const entries = Array.isArray(value)
    ? value.flatMap((entry) => collectSyncStateKeys(entry))
    : Object.entries(value).flatMap(([key, entry]) => [
        ...(key === 'syncState' ? [key] : []),
        ...collectSyncStateKeys(entry),
      ]);

  return entries;
}

describe('workspace backup export', () => {
  it('exports the current workspace with lists, routines, day state, and attachments', async () => {
    await createItem({
      title: 'Buy coffee',
      kind: 'task',
      lane: 'home',
      status: 'upcoming',
      body: 'Check pantry first.',
      sourceText: null,
      sourceItemId: null,
      captureMode: null,
      sourceDate: CURRENT_DATE,
      scheduledDate: '2026-04-21',
      scheduledTime: '18:00',
    });

    await createList({
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'home',
      pinned: true,
    });
    const [list] = await db.lists.toArray();
    await createListItem({
      listId: list!.id,
      title: 'Eggs',
      body: 'One dozen',
    });

    await createRoutine();
    const [routine] = await db.routines.toArray();
    await updateRoutine(routine!.id, {
      title: 'Check pantry',
      lane: 'home',
      destination: 'upcoming',
      weekdays: [0, 2, 4],
      scheduledTime: '09:30',
      notes: 'Before any grocery run.',
    });

    await toggleReadiness(CURRENT_DATE, 'water');
    await updateWeeklyRecord(CURRENT_DATE, {
      focus: 'Protect calm mornings.',
      protect: 'Sleep',
      notes: 'Keep errands contained.',
    });
    await updateSettings({
      direction: 'Stay steady at home.',
      standards: 'Eat first. Reset counters.',
      why: 'Calm is easier to hold when the basics are handled.',
    });

    const backup = await createWorkspaceBackup();
    const exported = await createWorkspaceBackupExport();

    expect(workspaceBackupFilename('2026-04-20T03:08:16.000Z')).toBe(
      'holdfast-backup-2026-04-20.json',
    );
    expect(backup.summary).toEqual({
      attachmentCount: 0,
      attachmentPayloadMissingCount: 0,
      dayCount: 1,
      itemCount: 1,
      listCount: 1,
      listItemCount: 1,
      routineCount: 1,
      weekCount: 1,
    });
    expect(backup.items[0]).toMatchObject({
      title: 'Buy coffee',
      body: 'Check pantry first.',
      status: 'upcoming',
    });
    expect(backup.lists[0]).toMatchObject({
      title: 'Groceries',
      kind: 'replenishment',
      pinned: true,
    });
    expect(backup.listItems[0]).toMatchObject({
      title: 'Eggs',
      body: 'One dozen',
      listId: list!.id,
    });
    expect(backup.routines[0]).toMatchObject({
      title: 'Check pantry',
      destination: 'upcoming',
      scheduledTime: '09:30',
    });
    expect(backup.dailyRecords[0]?.readiness.water).toBe(true);
    expect(backup.weeklyRecords[0]).toMatchObject({
      focus: 'Protect calm mornings.',
      protect: 'Sleep',
    });
    expect(backup.settings).toMatchObject({
      direction: 'Stay steady at home.',
      standards: 'Eat first. Reset counters.',
    });
    expect(backup.attachments).toEqual([]);
    expect(exported.filename).toBe(
      `holdfast-backup-${backup.exportedAt.slice(0, 10)}.json`,
    );
    expect(JSON.parse(await exported.blob.text())).toMatchObject({
      format: 'holdfast-backup',
      summary: backup.summary,
    });
    expect(
      collectSyncStateKeys(JSON.parse(await exported.blob.text())),
    ).toEqual([]);
  });

  it('fills backup attachments from sync when the local blob cache is missing', async () => {
    await updateSyncState({
      authState: 'signed-in',
      identityState: 'member',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
    });

    await createItem({
      title: 'Receipt',
      kind: 'task',
      lane: 'admin',
      status: 'inbox',
      body: '',
      sourceText: null,
      sourceItemId: null,
      captureMode: null,
      sourceDate: CURRENT_DATE,
      scheduledDate: null,
      scheduledTime: null,
    });

    const [item] = await db.items.toArray();
    await addFilesToItem(item!.id, [
      new File(['local-copy'], 'receipt.txt', { type: 'text/plain' }),
    ]);

    const [attachment] = await db.attachments.toArray();
    await db.attachmentBlobs.delete(attachment!.blobId);

    downloadAttachmentBlob.mockResolvedValue(
      new Blob(['remote-copy'], { type: 'text/plain' }),
    );

    const backup = await createWorkspaceBackup();

    expect(downloadAttachmentBlob).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      attachment!.id,
    );
    expect(backup.attachments[0]?.dataUrl).toBe(
      'data:text/plain;base64,cmVtb3RlLWNvcHk=',
    );
    expect(backup.attachments[0]?.payloadState).toBe('embedded');
  });

  it('keeps exporting when a signed-out member workspace is missing a local attachment blob', async () => {
    await updateSyncState({
      authState: 'signed-out',
      identityState: 'member',
      authPromptState: 'signed-out-by-user',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
    });

    await createItem({
      title: 'Receipt',
      kind: 'task',
      lane: 'admin',
      status: 'inbox',
      body: '',
      sourceText: null,
      sourceItemId: null,
      captureMode: null,
      sourceDate: CURRENT_DATE,
      scheduledDate: null,
      scheduledTime: null,
    });

    const [item] = await db.items.toArray();
    await addFilesToItem(item!.id, [
      new File(['local-copy'], 'receipt.txt', { type: 'text/plain' }),
    ]);

    const [attachment] = await db.attachments.toArray();
    await db.attachmentBlobs.delete(attachment!.blobId);

    const backup = await createWorkspaceBackup();

    expect(downloadAttachmentBlob).not.toHaveBeenCalled();
    expect(backup.summary.attachmentCount).toBe(1);
    expect(backup.summary.attachmentPayloadMissingCount).toBe(1);
    expect(backup.attachments[0]).toMatchObject({
      dataUrl: null,
      payloadState: 'missing',
    });
  });
});
