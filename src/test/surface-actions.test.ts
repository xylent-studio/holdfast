import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import {
  inboxCardActionSpecs,
  inboxPlacementActionSpecs,
  itemCardActionSpecs,
  listItemMoveActionSpecs,
  placementOptionSpecs,
  wholeListMoveActionSpecs,
} from '@/domain/logic/surface-actions';
import type { ListItemRecord, ListRecord } from '@/domain/schemas/records';

function makeList(overrides: Partial<ListRecord> = {}): ListRecord {
  return {
    id: 'list-1',
    schemaVersion: SCHEMA_VERSION,
    title: 'Groceries',
    kind: 'replenishment',
    lane: 'home',
    pinned: false,
    sourceItemId: null,
    scheduledDate: null,
    scheduledTime: null,
    completedAt: null,
    archivedAt: null,
    createdAt: '2026-04-27T08:00:00.000Z',
    updatedAt: '2026-04-27T08:00:00.000Z',
    deletedAt: null,
    syncState: 'pending',
    remoteRevision: null,
    ...overrides,
  };
}

function makeListItem(
  overrides: Partial<ListItemRecord> = {},
): ListItemRecord {
  return {
    id: 'list-item-1',
    schemaVersion: SCHEMA_VERSION,
    listId: 'list-1',
    title: 'Eggs',
    body: '',
    status: 'open',
    position: 0,
    sourceItemId: null,
    nowDate: null,
    completedAt: null,
    archivedAt: null,
    createdAt: '2026-04-27T08:00:00.000Z',
    updatedAt: '2026-04-27T08:00:00.000Z',
    deletedAt: null,
    syncState: 'pending',
    remoteRevision: null,
    ...overrides,
  };
}

describe('surface action specs', () => {
  it('keeps Inbox card movement to a single Place action', () => {
    expect(inboxCardActionSpecs()).toEqual([
      {
        id: 'place',
        label: 'Place',
        priority: 'primary',
        tone: 'accent',
      },
    ]);
  });

  it('keeps Inbox placement sheet choices in product order', () => {
    expect(inboxPlacementActionSpecs().map((action) => action.label)).toEqual([
      'Now',
      'Schedule',
      'List',
      'Keep undated',
      'Waiting on',
      'Archive',
    ]);
  });

  it('keeps Now movement contextual instead of showing generic move-out buttons', () => {
    expect(
      itemCardActionSpecs({ route: 'now', section: 'in-play' }, '2026-04-27'),
    ).toEqual([
      {
        id: 'focus',
        label: expect.stringMatching(/^Focus /),
        priority: 'primary',
        tone: 'accent',
      },
    ]);
    expect(
      itemCardActionSpecs({ route: 'now', section: 'focus' }, '2026-04-27'),
    ).toEqual([
      {
        id: 'remove-focus',
        label: 'Remove focus',
        priority: 'secondary',
        tone: 'ghost',
      },
    ]);
  });

  it('keeps Upcoming movement verbs section-specific', () => {
    expect(
      itemCardActionSpecs(
        { route: 'upcoming', section: 'scheduled' },
        '2026-04-27',
      ).map((action) => action.label),
    ).toEqual(['Bring to Now', 'Move to Waiting on', 'Archive']);
    expect(
      itemCardActionSpecs(
        { route: 'upcoming', section: 'undated' },
        '2026-04-27',
      ).map((action) => action.label),
    ).toEqual(['Schedule', 'Bring to Now', 'Move to Waiting on', 'Archive']);
    expect(
      itemCardActionSpecs(
        { route: 'upcoming', section: 'waiting' },
        '2026-04-27',
      ).map((action) => action.label),
    ).toEqual(['Bring to Now', 'Keep in Upcoming', 'Archive']);
  });

  it('uses contextual no-op copy in item details', () => {
    expect(
      placementOptionSpecs({ route: 'inbox' }, 'inbox', 'task').find(
        (option) => option.choice === 'inbox',
      )?.label,
    ).toBe('Keep in Inbox');
    expect(
      placementOptionSpecs(
        { route: 'upcoming', section: 'waiting' },
        'waiting',
        'task',
      ).find((option) => option.choice === 'waiting')?.label,
    ).toBe('Keep waiting');
  });

  it('hides redundant list item movement when the parent list is active', () => {
    expect(
      listItemMoveActionSpecs({
        list: makeList(),
        listItem: makeListItem(),
        wholeListActive: true,
      }),
    ).toEqual([]);
    expect(
      listItemMoveActionSpecs({
        list: makeList(),
        listItem: makeListItem({ nowDate: '2026-04-27' }),
        wholeListActive: false,
      }).map((action) => action.label),
    ).toEqual(['Remove from Now']);
  });

  it('keeps list placement and focus separate', () => {
    expect(
      wholeListMoveActionSpecs({
        currentDate: '2026-04-27',
        isFocused: false,
        list: makeList(),
      }).map((action) => action.label),
    ).toEqual(['Bring to Now', expect.stringMatching(/^Focus /)]);
  });
});
