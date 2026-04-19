import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import {
  repeatedOpenTitles,
  scheduledUpcomingItems,
} from '@/domain/logic/selectors';
import type { ItemRecord } from '@/domain/schemas/records';

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
        makeItem({ title: 'This week', scheduledDate: '2026-04-19' }),
        makeItem({ title: 'Next month', scheduledDate: '2026-05-04' }),
        makeItem({ title: 'Queue only', scheduledDate: null }),
        makeItem({
          title: 'Waiting',
          status: 'waiting',
          scheduledDate: '2026-04-21',
        }),
      ],
      '2026-04-18',
      'week',
    );

    expect(result.map((item) => item.title)).toEqual(['This week']);
  });
});
