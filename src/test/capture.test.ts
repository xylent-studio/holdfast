import { describe, expect, it } from 'vitest';

import {
  addContextForLocation,
  buildQuickAddDraft,
  parseUpcomingSection,
  planQuickAddItem,
  primaryAddDestinationForContext,
} from '@/domain/logic/capture';

describe('capture route context', () => {
  it('derives add context from the current route and upcoming section', () => {
    expect(addContextForLocation('/now', '')).toBe('now');
    expect(addContextForLocation('/review', '')).toBe('global');
    expect(addContextForLocation('/lists/list-1', '')).toBe('list');
    expect(addContextForLocation('/upcoming', '')).toBe('upcoming-scheduled');
    expect(addContextForLocation('/upcoming', '?section=undated')).toBe(
      'upcoming-undated',
    );
    expect(addContextForLocation('/upcoming', '?section=waiting')).toBe(
      'upcoming-waiting',
    );
  });

  it('falls back to scheduled when the upcoming section is missing or invalid', () => {
    expect(parseUpcomingSection(null)).toBe('scheduled');
    expect(parseUpcomingSection('wrong')).toBe('scheduled');
  });
});

describe('primary add destination', () => {
  it('maps each context to its obvious primary submit action', () => {
    expect(primaryAddDestinationForContext('global')).toBe('inbox');
    expect(primaryAddDestinationForContext('now')).toBe('now');
    expect(primaryAddDestinationForContext('upcoming-scheduled')).toBe(
      'scheduled',
    );
    expect(primaryAddDestinationForContext('upcoming-undated')).toBe('undated');
    expect(primaryAddDestinationForContext('upcoming-waiting')).toBe('waiting');
    expect(primaryAddDestinationForContext('list')).toBe('list');
  });
});

describe('planQuickAddItem', () => {
  it('defaults scheduled drafts to tomorrow without forcing classification', () => {
    expect(buildQuickAddDraft('2026-04-20')).toEqual({
      chosenDate: '2026-04-21',
      chosenTime: '',
    });
  });

  it('creates an uncertain Inbox capture when saved to Inbox', () => {
    const result = planQuickAddItem({
      rawText: 'groceries, eggs, coffee, check pantry first',
      currentDate: '2026-04-18',
      destination: 'inbox',
      chosenDate: '2026-04-19',
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

  it('creates a Now task when the user places it directly into Now', () => {
    const result = planQuickAddItem({
      rawText: 'Buy batteries',
      currentDate: '2026-04-18',
      destination: 'now',
      chosenDate: '2026-04-19',
      chosenTime: '',
      captureMode: 'context',
    });

    expect(result).toEqual({
      title: 'Buy batteries',
      kind: 'task',
      lane: 'admin',
      status: 'today',
      body: '',
      sourceText: 'Buy batteries',
      sourceItemId: null,
      captureMode: 'context',
      sourceDate: '2026-04-18',
      scheduledDate: '2026-04-18',
      scheduledTime: null,
    });
  });

  it('supports scheduled, undated, and waiting placements without asking task vs note', () => {
    expect(
      planQuickAddItem({
        rawText: 'Plan trip',
        currentDate: '2026-04-18',
        destination: 'scheduled',
        chosenDate: '2026-04-21',
        chosenTime: '09:30',
      }),
    ).toMatchObject({
      kind: 'task',
      status: 'upcoming',
      scheduledDate: '2026-04-21',
      scheduledTime: '09:30',
    });

    expect(
      planQuickAddItem({
        rawText: 'Keep for later',
        currentDate: '2026-04-18',
        destination: 'undated',
        chosenDate: '2026-04-21',
        chosenTime: '',
      }),
    ).toMatchObject({
      kind: 'task',
      status: 'upcoming',
      scheduledDate: null,
      scheduledTime: null,
    });

    expect(
      planQuickAddItem({
        rawText: 'Waiting on vendor',
        currentDate: '2026-04-18',
        destination: 'waiting',
        chosenDate: '2026-04-21',
        chosenTime: '',
      }),
    ).toMatchObject({
      kind: 'task',
      status: 'waiting',
      scheduledDate: null,
      scheduledTime: null,
    });
  });
});
