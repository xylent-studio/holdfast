import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { downloadAttachmentBlob } = vi.hoisted(() => ({
  downloadAttachmentBlob: vi.fn<
    (userId: string, attachmentId: string) => Promise<Blob | null>
  >(),
}));

vi.mock('@/storage/sync/supabase/attachments', () => ({
  downloadAttachmentBlob,
}));

import type { DateKey } from '@/domain/dates';
import {
  addFilesToItem,
  bootstrapHoldfast,
  createItem,
  getAttachmentDownload,
  updateSyncState,
} from '@/storage/local/api';
import { HOLDFAST_DB_NAME, db } from '@/storage/local/db';

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

describe('attachment download fallback', () => {
  it('downloads and caches the remote blob when the local cache is missing', async () => {
    await bootstrapHoldfast();
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
    await addFilesToItem(
      item!.id,
      [new File(['local-copy'], 'receipt.txt', { type: 'text/plain' })],
    );

    const [attachment] = await db.attachments.toArray();
    await db.attachmentBlobs.delete(attachment!.blobId);

    const remoteBlob = new Blob(['remote-copy'], { type: 'text/plain' });
    downloadAttachmentBlob.mockResolvedValue(remoteBlob);

    const result = await getAttachmentDownload(attachment!.id);
    const cachedBlobRow = await db.attachmentBlobs.get(attachment!.blobId);

    expect(downloadAttachmentBlob).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      attachment!.id,
    );
    expect(result).toEqual({
      blob: remoteBlob,
      name: 'receipt.txt',
      type: 'text/plain',
    });
    expect(cachedBlobRow).toBeTruthy();
  });
});
