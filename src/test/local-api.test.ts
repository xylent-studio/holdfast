import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DateKey } from '@/domain/dates';
import { itemsForToday } from '@/domain/logic/selectors';
import {
  createItem,
  createList,
  createListItem,
  deleteList,
  getHoldfastSnapshot,
  toggleFocus,
  toggleTaskDone,
  updateList,
  updateListItem,
} from '@/storage/local/api';
import { HOLDFAST_DB_NAME, db } from '@/storage/local/db';

const CURRENT_DATE = '2026-04-19' as DateKey;

async function resetLocalDatabase(): Promise<void> {
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
  await db.open();
}

beforeEach(async () => {
  await resetLocalDatabase();
});

afterEach(async () => {
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
});

describe('capture guardrails', () => {
  it('keeps capture items out of task-only controls and Now selectors', async () => {
    await createItem({
      title: 'Receipt and note',
      kind: 'capture',
      lane: 'admin',
      status: 'inbox',
      body: 'Save this before it disappears',
      sourceText: 'Receipt and note\n\nSave this before it disappears',
      sourceItemId: null,
      captureMode: 'uncertain',
      sourceDate: CURRENT_DATE,
      scheduledDate: null,
      scheduledTime: null,
    });

    const [capture] = await db.items.toArray();
    expect(capture).toBeTruthy();

    await toggleTaskDone(capture!.id, CURRENT_DATE);
    await toggleFocus(CURRENT_DATE, capture!.id);

    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);
    const updated = await db.items.get(capture!.id);

    expect(updated).toMatchObject({
      kind: 'capture',
      status: 'inbox',
      completedAt: null,
      scheduledDate: null,
    });
    expect(snapshot.currentDay.focusItemIds).toEqual([]);
    expect(itemsForToday(snapshot.items, CURRENT_DATE)).toEqual([]);
  });
});

describe('list mutation logging', () => {
  it('queues list and list-item mutations for create, update, and delete flows', async () => {
    await createList({
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'home',
      pinned: true,
    });

    const [list] = await db.lists.toArray();
    expect(list).toBeTruthy();

    await createListItem({ listId: list!.id, title: 'Eggs' });
    await createListItem({ listId: list!.id, title: 'Coffee' });

    const createdItems = await db.listItems
      .where('listId')
      .equals(list!.id)
      .sortBy('position');
    expect(createdItems.map((item) => item.position)).toEqual([0, 1]);

    await updateList(list!.id, { title: 'Groceries run', pinned: false });
    await updateListItem(createdItems[0]!.id, { status: 'done' });
    await deleteList(list!.id);

    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);
    const mutations = await db.mutationQueue.toArray();

    expect(snapshot.lists).toEqual([]);
    expect(snapshot.listItems).toEqual([]);
    expect(
      mutations.map((mutation) => `${mutation.entity}:${mutation.type}`).sort(),
    ).toEqual(
      [
        'list:list.created',
        'list:list.deleted',
        'list:list.updated',
        'listItem:list-item.created',
        'listItem:list-item.created',
        'listItem:list-item.deleted',
        'listItem:list-item.deleted',
        'listItem:list-item.updated',
      ].sort(),
    );
  });
});
