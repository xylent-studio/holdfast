import { describe, expect, it } from 'vitest';

import { planQuickAddItem } from '@/domain/logic/capture';

describe('planQuickAddItem', () => {
  it('defaults to uncertain Inbox capture without forced classification', () => {
    const result = planQuickAddItem({
      rawText: 'groceries, eggs, coffee, check pantry first',
      currentDate: '2026-04-18',
      shapeNow: false,
      kind: 'task',
      placement: 'today',
      timingMode: 'tomorrow',
      chosenDate: '2026-04-18',
      chosenTime: '',
    });

    expect(result).toEqual({
      title: 'groceries, eggs, coffee, check pantry first',
      kind: 'capture',
      lane: 'admin',
      status: 'inbox',
      body: '',
      sourceText: 'groceries, eggs, coffee, check pantry first',
      sourceItemId: null,
      captureMode: 'uncertain',
      sourceDate: '2026-04-18',
      scheduledDate: null,
      scheduledTime: null,
    });
  });

  it('supports deliberate placement when the user chooses to shape now', () => {
    const result = planQuickAddItem({
      rawText: 'Buy batteries',
      currentDate: '2026-04-18',
      shapeNow: true,
      kind: 'task',
      placement: 'upcoming',
      timingMode: 'tomorrow',
      chosenDate: '2026-04-18',
      chosenTime: '09:30',
    });

    expect(result).toEqual({
      title: 'Buy batteries',
      kind: 'task',
      lane: 'admin',
      status: 'upcoming',
      body: '',
      sourceText: 'Buy batteries',
      sourceItemId: null,
      captureMode: 'direct',
      sourceDate: '2026-04-18',
      scheduledDate: '2026-04-19',
      scheduledTime: '09:30',
    });
  });
});
