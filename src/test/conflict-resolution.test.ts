import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import {
  createItem,
  getHoldfastSnapshot,
  replaceItemWithLatestSavedVersion,
  saveItem,
} from '@/storage/local/api';
import { HOLDFAST_DB_NAME, db } from '@/storage/local/db';

const CURRENT_DATE = '2026-04-19' as DateKey;

const getSessionMock = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: maybeSingleMock,
      })),
    })),
  })),
}));

vi.mock('@/storage/sync/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
  }),
}));

async function resetLocalDatabase(): Promise<void> {
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
  await db.open();
}

beforeEach(async () => {
  await resetLocalDatabase();
  getSessionMock.mockReset();
  maybeSingleMock.mockReset();
  fromMock.mockClear();
});

afterEach(async () => {
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
});

describe('replaceItemWithLatestSavedVersion', () => {
  it('replaces a conflicted local item with the latest saved version and clears item mutations', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
          },
        },
      },
      error: null,
    });

    await createItem({
      title: 'Local copy',
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
    await saveItem(item!.id, {
      title: 'Local edit',
      kind: 'task',
      lane: 'admin',
      status: 'inbox',
      body: 'Unsynced local text',
      scheduledDate: null,
      scheduledTime: null,
    });
    await db.items.put({
      ...(await db.items.get(item!.id))!,
      syncState: 'conflict',
      remoteRevision: 'server-2',
    });

    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: 'user-1',
        id: item!.id,
        schema_version: SCHEMA_VERSION,
        title: 'Saved version',
        kind: 'task',
        lane: 'admin',
        status: 'inbox',
        body: 'Remote text',
        source_text: null,
        source_item_id: null,
        capture_mode: null,
        source_date: CURRENT_DATE,
        scheduled_date: null,
        scheduled_time: null,
        routine_id: null,
        completed_at: null,
        archived_at: null,
        created_at: '2026-04-19T08:00:00.000Z',
        updated_at: '2026-04-19T09:00:00.000Z',
        deleted_at: null,
        server_updated_at: 'server-2',
      },
      error: null,
    });

    await replaceItemWithLatestSavedVersion(item!.id);

    const updated = await db.items.get(item!.id);
    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);

    expect(fromMock).toHaveBeenCalledWith('items');
    expect(updated).toMatchObject({
      title: 'Saved version',
      body: 'Remote text',
      syncState: 'synced',
      remoteRevision: 'server-2',
    });
    expect(snapshot.items[0]?.title).toBe('Saved version');
    expect(
      (await db.mutationQueue.toArray()).filter(
        (mutation) => mutation.entity === 'item' && mutation.entityId === item!.id,
      ),
    ).toEqual([]);
  });
});
