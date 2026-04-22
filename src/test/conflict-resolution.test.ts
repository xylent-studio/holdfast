import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import {
  createList,
  createListItem,
  createItem,
  getHoldfastSnapshot,
  replaceItemWithLatestSavedVersion,
  replaceListItemWithLatestSavedVersion,
  replaceListWithLatestSavedVersion,
  saveItem,
  updateList,
  updateListItem,
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

describe('replaceListWithLatestSavedVersion', () => {
  it('replaces a conflicted local list with the latest saved version and clears list mutations', async () => {
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

    await createList({
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'home',
      pinned: false,
    });

    const [list] = await db.lists.toArray();
    await updateList(list!.id, {
      title: 'Groceries for home',
      pinned: true,
    });
    await db.lists.put({
      ...(await db.lists.get(list!.id))!,
      syncState: 'conflict',
      remoteRevision: 'server-list-2',
    });

    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: 'user-1',
        id: list!.id,
        schema_version: SCHEMA_VERSION,
        title: 'Saved groceries',
        kind: 'replenishment',
        lane: 'home',
        pinned: false,
        source_item_id: null,
        archived_at: null,
        created_at: '2026-04-19T08:00:00.000Z',
        updated_at: '2026-04-19T09:00:00.000Z',
        deleted_at: null,
        server_updated_at: 'server-list-2',
      },
      error: null,
    });

    await replaceListWithLatestSavedVersion(list!.id);

    const updated = await db.lists.get(list!.id);

    expect(fromMock).toHaveBeenCalledWith('lists');
    expect(updated).toMatchObject({
      title: 'Saved groceries',
      pinned: false,
      syncState: 'synced',
      remoteRevision: 'server-list-2',
    });
    expect(
      (await db.mutationQueue.toArray()).filter(
        (mutation) => mutation.entity === 'list' && mutation.entityId === list!.id,
      ),
    ).toEqual([]);
  });
});

describe('replaceListItemWithLatestSavedVersion', () => {
  it('replaces a conflicted local list item with the latest saved version and clears list-item mutations', async () => {
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

    await createList({
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'home',
      pinned: false,
    });

    const [list] = await db.lists.toArray();
    await createListItem({
      listId: list!.id,
      title: 'Eggs',
      body: '',
    });

    const [listItem] = await db.listItems.toArray();
    await updateListItem(listItem!.id, {
      title: 'Eggs and coffee',
      body: 'Check pantry first',
    });
    await db.listItems.put({
      ...(await db.listItems.get(listItem!.id))!,
      syncState: 'conflict',
      remoteRevision: 'server-list-item-2',
    });

    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: 'user-1',
        id: listItem!.id,
        schema_version: SCHEMA_VERSION,
        list_id: list!.id,
        title: 'Saved eggs',
        body: 'Remote note',
        status: 'open',
        position: 0,
        source_item_id: null,
        promoted_item_id: null,
        completed_at: null,
        archived_at: null,
        created_at: '2026-04-19T08:00:00.000Z',
        updated_at: '2026-04-19T09:00:00.000Z',
        deleted_at: null,
        server_updated_at: 'server-list-item-2',
      },
      error: null,
    });

    await replaceListItemWithLatestSavedVersion(listItem!.id);

    const updated = await db.listItems.get(listItem!.id);

    expect(fromMock).toHaveBeenCalledWith('list_items');
    expect(updated).toMatchObject({
      title: 'Saved eggs',
      body: 'Remote note',
      syncState: 'synced',
      remoteRevision: 'server-list-item-2',
    });
    expect(
      (await db.mutationQueue.toArray()).filter(
        (mutation) =>
          mutation.entity === 'listItem' && mutation.entityId === listItem!.id,
      ),
    ).toEqual([]);
  });
});
