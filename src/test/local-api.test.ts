import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DateKey } from '@/domain/dates';
import { itemsForToday } from '@/domain/logic/selectors';
import {
  closeDay,
  createItem,
  createList,
  createListItem,
  deleteList,
  deleteItem,
  getHoldfastSnapshot,
  removeDataFromDevice,
  toggleFocus,
  toggleTaskDone,
  updateWorkspaceState,
  updateList,
  updateListItem,
  addFilesToItem,
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
  it('returns a snapshot on an empty database without writing during read', async () => {
    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);

    expect(snapshot.currentDate).toBe(CURRENT_DATE);
    expect(snapshot.currentDay.date).toBe(CURRENT_DATE);
    expect(snapshot.items).toEqual([]);
    expect(snapshot.lists).toEqual([]);
    expect(snapshot.listItems).toEqual([]);
    expect(snapshot.syncState.id).toBe('sync');
  });

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

  it('reopens a terminal item into Now without stale completion or archive state', async () => {
    await createItem({
      title: 'Reopen me',
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
    await db.items.put({
      ...item!,
      status: 'archived',
      archivedAt: '2026-04-18T20:00:00.000Z',
      completedAt: '2026-04-18T19:00:00.000Z',
      updatedAt: '2026-04-18T20:00:00.000Z',
      syncState: 'pending',
    });

    await toggleFocus(CURRENT_DATE, item!.id);

    const updated = await db.items.get(item!.id);

    expect(updated).toMatchObject({
      status: 'today',
      scheduledDate: CURRENT_DATE,
      completedAt: null,
      archivedAt: null,
    });
  });
});

describe('close day carry-forward behavior', () => {
  it('turns matched alive work into real Upcoming items and only creates new tasks for unmatched lines', async () => {
    await createItem({
      title: 'Call the landlord',
      kind: 'task',
      lane: 'admin',
      status: 'today',
      body: '',
      sourceText: null,
      sourceItemId: null,
      captureMode: null,
      sourceDate: CURRENT_DATE,
      scheduledDate: CURRENT_DATE,
      scheduledTime: null,
    });
    await createItem({
      title: 'Existing capture',
      kind: 'capture',
      lane: 'admin',
      status: 'inbox',
      body: '',
      sourceText: 'Existing capture',
      sourceItemId: null,
      captureMode: 'uncertain',
      sourceDate: CURRENT_DATE,
      scheduledDate: null,
      scheduledTime: null,
    });

    const [landlordTask] = (await db.items.toArray()).filter(
      (item) => item.title === 'Call the landlord',
    );

    await closeDay(CURRENT_DATE, {
      closeWin: '',
      closeCarry: 'Call the landlord\nBuy batteries',
      closeSeed: 'Start with coffee',
      closeNote: '',
    });

    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);
    const allItems = await db.items.toArray();
    const updatedLandlord = allItems.find((item) => item.id === landlordTask!.id);
    const createdCarry = allItems.find((item) => item.title === 'Buy batteries');
    const mutationTypes = (await db.mutationQueue.toArray()).map(
      (mutation) => `${mutation.entity}:${mutation.type}:${mutation.entityId}`,
    );

    expect(updatedLandlord).toMatchObject({
      id: landlordTask!.id,
      status: 'upcoming',
      scheduledDate: '2026-04-20',
      completedAt: null,
      archivedAt: null,
    });
    expect(createdCarry).toMatchObject({
      status: 'upcoming',
      scheduledDate: '2026-04-20',
    });
    expect(
      allItems.filter((item) => item.title === 'Call the landlord'),
    ).toHaveLength(1);
    expect(mutationTypes).toContain(`item:item.updated:${landlordTask!.id}`);
    expect(mutationTypes).toContain(`item:item.created:${createdCarry!.id}`);
    expect(snapshot.currentDay.closeCarry).toBe('Call the landlord\nBuy batteries');
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

describe('item deletion sync coverage', () => {
  it('queues attachment deletions before deleting the item', async () => {
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
    const file = new File(['receipt'], 'receipt.txt', { type: 'text/plain' });
    await addFilesToItem(item!.id, [file]);
    const [attachment] = await db.attachments.toArray();

    await deleteItem(item!.id);

    const mutations = (await db.mutationQueue.toArray())
      .map((mutation) => `${mutation.entity}:${mutation.entityId}:${mutation.type}`)
      .sort();

    expect(mutations).toContain(
      `attachment:${attachment!.id}:attachment.deleted`,
    );
    expect(mutations).toContain(`item:${item!.id}:item.deleted`);
    expect(await db.attachments.count()).toBe(0);
    expect(await db.attachmentBlobs.count()).toBe(0);
  });
});

describe('device data removal', () => {
  it('clears the local workspace back to a fresh device state', async () => {
    await createItem({
      title: 'Keep moving',
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
    await createList({
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'home',
      pinned: true,
    });
    const [item] = await db.items.toArray();
    await addFilesToItem(
      item!.id,
      [new File(['receipt'], 'receipt.txt', { type: 'text/plain' })],
    );
    await updateWorkspaceState({
      ownershipState: 'member',
      boundUserId: '11111111-1111-4111-8111-111111111111',
      authPromptState: 'signed-out-by-user',
      attachState: 'detached-restore',
    });

    await removeDataFromDevice();

    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);

    expect(snapshot.items).toEqual([]);
    expect(snapshot.lists).toEqual([]);
    expect(snapshot.listItems).toEqual([]);
    expect(await db.attachments.count()).toBe(0);
    expect(await db.attachmentBlobs.count()).toBe(0);
    expect(await db.mutationQueue.count()).toBe(0);
    expect(snapshot.workspaceState).toMatchObject({
      ownershipState: 'device-guest',
      boundUserId: null,
      authPromptState: 'none',
      attachState: 'attached',
    });
  });
});
