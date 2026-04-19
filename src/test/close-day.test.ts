import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { buildCarryForwardTasks } from '@/domain/logic/close-day';
import type { ItemRecord } from '@/domain/schemas/records';

function makeItem(title: string, status: ItemRecord['status'] = 'upcoming'): ItemRecord {
  return {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    title,
    kind: 'task',
    lane: 'admin',
    status,
    body: '',
    sourceDate: '2026-04-18',
    scheduledDate: '2026-04-19',
    scheduledTime: null,
    routineId: null,
    completedAt: null,
    archivedAt: null,
    createdAt: '2026-04-18T08:00:00.000Z',
    updatedAt: '2026-04-18T08:00:00.000Z',
    deletedAt: null,
    syncState: 'pending',
  };
}

describe('buildCarryForwardTasks', () => {
  it('creates next-day tasks for each non-empty carry line', () => {
    const result = buildCarryForwardTasks('Call the landlord\nBuy batteries', '2026-04-19', []);

    expect(result).toEqual([
      { title: 'Call the landlord', scheduledDate: '2026-04-19' },
      { title: 'Buy batteries', scheduledDate: '2026-04-19' },
    ]);
  });

  it('skips carry lines that already exist as open items', () => {
    const result = buildCarryForwardTasks(
      'Call the landlord\nBuy batteries',
      '2026-04-19',
      [makeItem('call   the landlord'), makeItem('Buy batteries', 'done')],
    );

    expect(result).toEqual([{ title: 'Buy batteries', scheduledDate: '2026-04-19' }]);
  });
});
