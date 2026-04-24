import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DateKey } from '@/domain/dates';
import { itemsForToday } from '@/domain/logic/selectors';
import {
  closeDay,
  createItem,
  createList,
  createListItem,
  createTaskFromListItem,
  createListWithFirstItem,
  deleteList,
  deleteItem,
  finishList,
  getHoldfastSnapshot,
  moveListToNow,
  moveItemToNow,
  moveItemToList,
  promoteListItemToNow,
  reopenAllDoneListItems,
  removeDataFromDevice,
  scheduleList,
  sendInboxCaptureToList,
  sendInboxCaptureToNewList,
  setItemFocus,
  setListFocus,
  toggleTaskDone,
  updateWorkspaceState,
  updateList,
  updateListItem,
  addFilesToItem,
  bootstrapHoldfast,
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
    await setItemFocus(CURRENT_DATE, capture!.id, true);

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

    await moveItemToNow(item!.id, CURRENT_DATE);

    const updated = await db.items.get(item!.id);

    expect(updated).toMatchObject({
      status: 'today',
      scheduledDate: CURRENT_DATE,
      completedAt: null,
      archivedAt: null,
    });
  });

  it('backfills a member workspace marker when legacy synced data exists without workspace state', async () => {
    await createItem({
      title: 'Already synced elsewhere',
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
      remoteRevision: 'server-item-1',
      syncState: 'synced',
    });
    await db.syncState.put({
      id: 'sync',
      schemaVersion: 5,
      provider: 'supabase',
      mode: 'ready',
      blockedReason: null,
      lastFailureAt: null,
      lastSyncedAt: '2026-04-19T08:00:00.000Z',
      lastTransportError: null,
      pullCursorByStream: {
        items: { updatedAt: '2026-04-19T08:00:00.000Z', id: item!.id },
        lists: { updatedAt: null, id: null },
        listItems: { updatedAt: null, id: null },
        dailyRecords: { updatedAt: null, id: null },
        weeklyRecords: { updatedAt: null, id: null },
        routines: { updatedAt: null, id: null },
        settings: { updatedAt: null, id: null },
        attachments: { updatedAt: null, id: null },
        deletedRecords: { updatedAt: null, id: null },
      },
      createdAt: '2026-04-19T08:00:00.000Z',
      updatedAt: '2026-04-19T08:00:00.000Z',
    });

    await db.workspaceState.clear();
    await bootstrapHoldfast();

    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);

    expect(snapshot.workspaceState).toMatchObject({
      ownershipState: 'member',
      authPromptState: 'session-expired',
      attachState: 'attached',
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
        'list:list.updated',
        'list:list.updated',
        'list:list.updated',
        'list:list.updated',
        'list:list.deleted',
        'listItem:list-item.created',
        'listItem:list-item.created',
        'listItem:list-item.deleted',
        'listItem:list-item.deleted',
        'listItem:list-item.updated',
      ].sort(),
    );
  });
});

describe('list creation and capture transfer flows', () => {
  it('can create a list together with its first list item', async () => {
    const listId = await createListWithFirstItem(
      {
        title: 'Weekend prep',
        kind: 'checklist',
        lane: 'admin',
      },
      {
        title: 'Pack charger',
        body: 'USB-C brick too',
      },
    );

    const list = await db.lists.get(listId);
    const listItems = await db.listItems.where('listId').equals(listId).toArray();
    const mutations = (await db.mutationQueue.toArray()).map(
      (mutation) => `${mutation.entity}:${mutation.type}`,
    );

    expect(list).toMatchObject({
      title: 'Weekend prep',
      kind: 'checklist',
    });
    expect(listItems).toHaveLength(1);
    expect(listItems[0]).toMatchObject({
      title: 'Pack charger',
      body: 'USB-C brick too',
      position: 0,
      sourceItemId: null,
    });
    expect(mutations).toContain('list:list.created');
    expect(mutations).toContain('listItem:list-item.created');
  });

  it('archives an inbox capture after sending it to an existing list and preserves sourceItemId', async () => {
    await createItem({
      title: 'Eggs',
      kind: 'capture',
      lane: 'admin',
      status: 'inbox',
      body: 'Check pantry first',
      sourceText: 'Eggs\n\nCheck pantry first',
      sourceItemId: null,
      captureMode: 'uncertain',
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

    const [capture] = await db.items.toArray();
    const [list] = await db.lists.toArray();

    await sendInboxCaptureToList(capture!.id, list!.id);

    const updatedCapture = await db.items.get(capture!.id);
    const [listItem] = await db.listItems.where('listId').equals(list!.id).toArray();
    const mutations = (await db.mutationQueue.toArray()).map(
      (mutation) => `${mutation.entity}:${mutation.type}:${mutation.entityId}`,
    );

    expect(updatedCapture).toMatchObject({
      status: 'archived',
      archivedAt: expect.any(String),
    });
    expect(listItem).toMatchObject({
      title: 'Eggs',
      body: 'Check pantry first',
      sourceItemId: capture!.id,
    });
    expect(mutations).toContain(`item:item.updated:${capture!.id}`);
    expect(mutations).toContain(`listItem:list-item.created:${listItem!.id}`);
  });

  it('can create a new list from an inbox capture and archive the original capture', async () => {
    await createItem({
      title: 'Eggs',
      kind: 'capture',
      lane: 'admin',
      status: 'inbox',
      body: 'Check pantry first',
      sourceText: 'Eggs\n\nCheck pantry first',
      sourceItemId: null,
      captureMode: 'uncertain',
      sourceDate: CURRENT_DATE,
      scheduledDate: null,
      scheduledTime: null,
    });

    const [capture] = await db.items.toArray();
    const listId = await sendInboxCaptureToNewList(capture!.id, {
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'admin',
    });

    const list = await db.lists.get(listId!);
    const [listItem] = await db.listItems.where('listId').equals(listId!).toArray();
    const updatedCapture = await db.items.get(capture!.id);

    expect(list).toMatchObject({
      title: 'Groceries',
      kind: 'replenishment',
    });
    expect(listItem).toMatchObject({
      title: 'Eggs',
      sourceItemId: capture!.id,
    });
    expect(updatedCapture).toMatchObject({
      status: 'archived',
    });
  });

  it('can move a top-level task into an existing list and archive the original item', async () => {
    await createItem({
      title: 'Printer ink',
      kind: 'task',
      lane: 'admin',
      status: 'upcoming',
      body: 'Black first',
      sourceText: 'Printer ink\n\nBlack first',
      sourceItemId: null,
      captureMode: 'direct',
      sourceDate: CURRENT_DATE,
      scheduledDate: null,
      scheduledTime: null,
    });
    await createList({
      title: 'Errands',
      kind: 'project',
      lane: 'home',
    });

    const [item] = await db.items.toArray();
    const [list] = await db.lists.toArray();

    await moveItemToList(item!.id, list!.id);

    const updatedItem = await db.items.get(item!.id);
    const [listItem] = await db.listItems.where('listId').equals(list!.id).toArray();

    expect(updatedItem).toMatchObject({
      status: 'archived',
      archivedAt: expect.any(String),
    });
    expect(listItem).toMatchObject({
      title: 'Printer ink',
      body: 'Black first',
      sourceItemId: item!.id,
      status: 'open',
    });
  });

  it('sends a list item into Now without creating a duplicate top-level task', async () => {
    await createList({
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'home',
    });

    const [list] = await db.lists.toArray();
    await createListItem({
      listId: list!.id,
      title: 'Eggs',
      body: 'Check pantry first',
    });

    const [originalListItem] = await db.listItems.toArray();
    const itemsBeforePromotion = await db.items.count();
    await promoteListItemToNow(originalListItem!.id, CURRENT_DATE);

    const promotedListItem = await db.listItems.get(originalListItem!.id);
    expect(promotedListItem).toMatchObject({
      title: 'Eggs',
      body: 'Check pantry first',
      nowDate: CURRENT_DATE,
      status: 'open',
    });
    expect(await db.items.count()).toBe(itemsBeforePromotion);
  });

  it('can still create a separate top-level task from a list item when asked explicitly', async () => {
    await createList({
      title: 'Weekend prep',
      kind: 'checklist',
      lane: 'admin',
    });

    const [list] = await db.lists.toArray();
    await createListItem({
      listId: list!.id,
      title: 'Pack charger',
      body: 'USB-C brick too',
    });

    const [listItem] = await db.listItems.toArray();
    const createdTaskId = await createTaskFromListItem(listItem!.id, CURRENT_DATE);
    const createdTask = createdTaskId ? await db.items.get(createdTaskId) : null;

    expect(createdTask).toMatchObject({
      title: 'Pack charger',
      body: 'USB-C brick too',
      status: 'today',
      sourceItemId: listItem!.id,
      scheduledDate: CURRENT_DATE,
    });
  });

  it('can reopen all done checklist items together', async () => {
    await createList({
      title: 'Weekend prep',
      kind: 'checklist',
      lane: 'admin',
    });

    const [list] = await db.lists.toArray();
    await createListItem({ listId: list!.id, title: 'Pack charger' });

    const [listItem] = await db.listItems.toArray();
    await updateListItem(listItem!.id, { status: 'done' });
    await reopenAllDoneListItems(list!.id);

    const reopened = await db.listItems.get(listItem!.id);

    expect(reopened).toMatchObject({
      status: 'open',
      completedAt: null,
    });
  });
});

describe('whole-list activation and finish lifecycle', () => {
  it('can move, schedule, and focus a whole list for a specific day', async () => {
    await createList({
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'home',
    });

    const [list] = await db.lists.toArray();

    await scheduleList(list!.id, '2026-04-21', '09:30');
    await moveListToNow(list!.id, CURRENT_DATE);
    await setListFocus(CURRENT_DATE, list!.id, true);

    const updatedList = await db.lists.get(list!.id);
    const currentDay = await db.dailyRecords.get(CURRENT_DATE);

    expect(updatedList).toMatchObject({
      scheduledDate: CURRENT_DATE,
      scheduledTime: null,
      completedAt: null,
    });
    expect(currentDay?.focusListIds).toEqual([list!.id]);

    await setListFocus(CURRENT_DATE, list!.id, false);

    const unfocusedDay = await db.dailyRecords.get(CURRENT_DATE);
    expect(unfocusedDay?.focusListIds).toEqual([]);
    expect((await db.lists.get(list!.id))?.scheduledDate).toBe(CURRENT_DATE);
  });

  it('archives a reusable run snapshot and resets the live list for reuse', async () => {
    await createList({
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'home',
    });

    const [list] = await db.lists.toArray();
    await createListItem({ listId: list!.id, title: 'Eggs' });
    await createListItem({ listId: list!.id, title: 'Coffee' });

    const [eggs] = await db.listItems.where('listId').equals(list!.id).sortBy('position');
    await updateListItem(eggs!.id, { status: 'done' });
    await setListFocus(CURRENT_DATE, list!.id, true);

    await finishList(list!.id, 'archive-run-and-reset', CURRENT_DATE);

    const lists = await db.lists.toArray();
    const liveList = lists.find((entry) => entry.id === list!.id);
    const archivedRun = lists.find(
      (entry) => entry.id !== list!.id && entry.archivedAt,
    );
    const liveItems = await db.listItems.where('listId').equals(list!.id).sortBy('position');
    const archivedItems = archivedRun
      ? await db.listItems.where('listId').equals(archivedRun.id).sortBy('position')
      : [];
    const currentDay = await db.dailyRecords.get(CURRENT_DATE);

    expect(liveList).toMatchObject({
      scheduledDate: null,
      scheduledTime: null,
      completedAt: null,
      archivedAt: null,
    });
    expect(liveItems.map((item) => item.status)).toEqual(['open', 'open']);
    expect(archivedRun).toMatchObject({
      title: 'Groceries',
      completedAt: expect.any(String),
      archivedAt: expect.any(String),
      scheduledDate: CURRENT_DATE,
    });
    expect(archivedItems.map((item) => item.status)).toEqual(['done', 'open']);
    expect(currentDay?.focusListIds).toEqual([]);
  });

  it('can clear list items for reuse without deleting the live list', async () => {
    await createList({
      title: 'Weekend prep',
      kind: 'project',
      lane: 'admin',
    });

    const [list] = await db.lists.toArray();
    await createListItem({ listId: list!.id, title: 'Pack charger' });
    await moveListToNow(list!.id, CURRENT_DATE);

    await finishList(list!.id, 'clear-items-for-reuse', CURRENT_DATE);

    const updatedList = await db.lists.get(list!.id);
    const remainingActiveItems = (await db.listItems.where('listId').equals(list!.id).toArray()).filter(
      (item) => !item.deletedAt,
    );

    expect(updatedList).toMatchObject({
      scheduledDate: null,
      scheduledTime: null,
      completedAt: null,
      archivedAt: null,
    });
    expect(remainingActiveItems).toEqual([]);
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
