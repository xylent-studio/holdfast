import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import {
  itemsForToday,
  overdueItems,
  reviewListSummaries,
  repeatedOpenTitles,
  scheduledUpcomingItems,
  searchWorkspace,
} from '@/domain/logic/selectors';
import type {
  AttachmentRecord,
  DailyRecord,
  ItemRecord,
  ListItemRecord,
  ListRecord,
} from '@/domain/schemas/records';

function makeItem(overrides: Partial<ItemRecord>): ItemRecord {
  return {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    title: 'Untitled',
    kind: 'task',
    lane: 'admin',
    status: 'upcoming',
    body: '',
    sourceText: null,
    sourceItemId: null,
    captureMode: null,
    sourceDate: '2026-04-18',
    scheduledDate: null,
    scheduledTime: null,
    routineId: null,
    completedAt: null,
    archivedAt: null,
    createdAt: '2026-04-18T08:00:00.000Z',
    updatedAt: '2026-04-18T08:00:00.000Z',
    deletedAt: null,
    syncState: 'pending',
    ...overrides,
  };
}

describe('repeatedOpenTitles', () => {
  it('counts only open items and normalizes whitespace', () => {
    const result = repeatedOpenTitles([
      makeItem({ title: 'Email accountant', status: 'inbox' }),
      makeItem({ title: 'Email   accountant', status: 'today' }),
      makeItem({ title: 'Email accountant', status: 'done' }),
      makeItem({ title: 'Different thing', status: 'upcoming' }),
    ]);

    expect(result).toEqual([['Email accountant', 2]]);
  });
});

describe('scheduledUpcomingItems', () => {
  it('returns only upcoming items within the selected window', () => {
    const result = scheduledUpcomingItems(
      [
        makeItem({ title: 'Due today', scheduledDate: '2026-04-18' }),
        makeItem({ title: 'This week', scheduledDate: '2026-04-19' }),
        makeItem({ title: 'Next month', scheduledDate: '2026-05-04' }),
        makeItem({ title: 'Undated', scheduledDate: null }),
        makeItem({ title: 'Overdue', scheduledDate: '2026-04-17' }),
        makeItem({
          title: 'Waiting',
          status: 'waiting',
          scheduledDate: '2026-04-21',
        }),
      ],
      '2026-04-18',
    );

    expect(result.map((item) => item.title)).toEqual([
      'Due today',
      'This week',
      'Next month',
    ]);
  });
});

describe('Now ownership selectors', () => {
  it('keeps due-today planned items in Now and overdue items in overdue pressure', () => {
    const items = [
      makeItem({
        title: 'Due today',
        status: 'upcoming',
        scheduledDate: '2026-04-18',
      }),
      makeItem({
        title: 'Future',
        status: 'upcoming',
        scheduledDate: '2026-04-20',
      }),
      makeItem({
        title: 'Overdue',
        status: 'upcoming',
        scheduledDate: '2026-04-17',
      }),
    ];

    expect(itemsForToday(items, '2026-04-18').map((item) => item.title)).toEqual([
      'Due today',
    ]);
    expect(overdueItems(items, '2026-04-18').map((item) => item.title)).toEqual([
      'Overdue',
    ]);
  });
});

function makeAttachment(overrides: Partial<AttachmentRecord>): AttachmentRecord {
  return {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    itemId: crypto.randomUUID(),
    blobId: crypto.randomUUID(),
    kind: 'file',
    name: 'receipt.pdf',
    mimeType: 'application/pdf',
    size: 128,
    createdAt: '2026-04-18T08:00:00.000Z',
    updatedAt: '2026-04-18T08:00:00.000Z',
    deletedAt: null,
    syncState: 'pending',
    ...overrides,
  };
}

function makeDay(overrides: Partial<DailyRecord>): DailyRecord {
  return {
    date: '2026-04-18',
    schemaVersion: SCHEMA_VERSION,
    startedAt: null,
    closedAt: null,
    readiness: {
      water: false,
      food: false,
      supplements: false,
      hygiene: false,
      movement: false,
      sleepSetup: false,
    },
    focusItemIds: [],
    launchNote: '',
    closeWin: '',
    closeCarry: '',
    closeSeed: '',
    closeNote: '',
    seededRoutineIds: [],
    createdAt: '2026-04-18T08:00:00.000Z',
    updatedAt: '2026-04-18T08:00:00.000Z',
    syncState: 'pending',
    ...overrides,
  };
}

function makeList(overrides: Partial<ListRecord>): ListRecord {
  return {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    title: 'Groceries',
    kind: 'replenishment',
    lane: 'home',
    pinned: true,
    sourceItemId: null,
    archivedAt: null,
    createdAt: '2026-04-18T08:00:00.000Z',
    updatedAt: '2026-04-18T08:00:00.000Z',
    deletedAt: null,
    syncState: 'pending',
    ...overrides,
  };
}

function makeListItem(overrides: Partial<ListItemRecord>): ListItemRecord {
  return {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    listId: crypto.randomUUID(),
    title: 'Eggs',
    body: '',
    status: 'open',
    position: 0,
    sourceItemId: null,
    nowDate: null,
    completedAt: null,
    archivedAt: null,
    createdAt: '2026-04-18T08:00:00.000Z',
    updatedAt: '2026-04-18T08:00:00.000Z',
    deletedAt: null,
    syncState: 'pending',
    ...overrides,
  };
}

describe('searchWorkspace', () => {
  it('finds attachment names, lists, and list items newest-first', () => {
    const list = makeList({
      id: 'list-1',
      title: 'Groceries',
      updatedAt: '2026-04-18T08:00:00.000Z',
    });
    const listItem = makeListItem({
      id: 'list-item-1',
      listId: list.id,
      title: 'Check pantry first',
      body: 'Eggs and coffee',
      updatedAt: '2026-04-18T10:00:00.000Z',
    });
    const item = {
      ...makeItem({
        id: 'item-1',
        title: 'Save receipt',
        updatedAt: '2026-04-18T09:00:00.000Z',
      }),
      attachments: [makeAttachment({ itemId: 'item-1', name: 'pantry-receipt.pdf' })],
    };
    const day = makeDay({
      closeWin: 'Checked the pantry',
      updatedAt: '2026-04-18T07:00:00.000Z',
    });

    const listResults = searchWorkspace(
      [item],
      [day],
      [list],
      [listItem],
      'groceries',
    );
    expect(listResults[0]).toMatchObject({
      type: 'listItem',
      listItem: { id: 'list-item-1' },
    });
    expect(listResults[1]).toMatchObject({
      type: 'list',
      list: { id: 'list-1' },
    });

    const attachmentResults = searchWorkspace(
      [item],
      [day],
      [list],
      [listItem],
      'receipt',
    );
    expect(attachmentResults[0]).toMatchObject({
      type: 'item',
      item: { id: 'item-1' },
    });
  });
});

describe('reviewListSummaries', () => {
  it('surfaces pinned active lists with open counts and previews', () => {
    const list = makeList({ id: 'list-1', title: 'Groceries', pinned: true });
    const secondList = makeList({
      id: 'list-2',
      title: 'Trip prep',
      pinned: false,
      updatedAt: '2026-04-18T07:00:00.000Z',
    });

    const result = reviewListSummaries(
      [list, secondList],
      [
        makeListItem({ listId: list.id, title: 'Eggs', position: 0 }),
        makeListItem({ listId: list.id, title: 'Coffee', position: 1 }),
        makeListItem({ listId: list.id, title: 'Done item', status: 'done' }),
      ],
    );

    expect(result[0]).toMatchObject({
      list: { id: 'list-1' },
      openCount: 2,
      doneCount: 1,
      previewTitles: ['Eggs', 'Coffee'],
    });
  });
});
