import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { ReviewView } from '@/features/review/ReviewView';
import type { HoldfastSnapshot } from '@/storage/local/api';

function makeSnapshot(): HoldfastSnapshot {
  return {
    currentDate: '2026-04-20',
    items: [
      {
        id: 'item-1',
        schemaVersion: SCHEMA_VERSION,
        title: 'Buy coffee',
        kind: 'task',
        lane: 'admin',
        status: 'upcoming',
        body: '',
        sourceText: 'Buy coffee',
        sourceItemId: null,
        captureMode: 'direct',
        sourceDate: '2026-04-20',
        scheduledDate: '2026-04-21',
        scheduledTime: null,
        routineId: null,
        completedAt: null,
        archivedAt: null,
        createdAt: '2026-04-20T08:00:00.000Z',
        updatedAt: '2026-04-20T08:00:00.000Z',
        deletedAt: null,
        syncState: 'pending',
        attachments: [],
      },
    ],
    lists: [],
    listItems: [],
    dailyRecords: [
      {
        date: '2026-04-19',
        schemaVersion: SCHEMA_VERSION,
        startedAt: '2026-04-19T08:00:00.000Z',
        closedAt: '2026-04-19T20:00:00.000Z',
        readiness: {
          water: true,
          food: true,
          supplements: false,
          hygiene: true,
          movement: false,
          sleepSetup: false,
        },
        focusItemIds: [],
        launchNote: 'Keep moving',
        closeWin: 'Shipped the hard part',
        closeCarry: '',
        closeSeed: 'Start with coffee',
        closeNote: '',
        seededRoutineIds: [],
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T20:00:00.000Z',
        syncState: 'pending',
      },
      {
        date: '2026-04-20',
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
        createdAt: '2026-04-20T08:00:00.000Z',
        updatedAt: '2026-04-20T08:00:00.000Z',
        syncState: 'pending',
      },
    ],
    weeklyRecord: {
      weekStart: '2026-04-20',
      schemaVersion: SCHEMA_VERSION,
      focus: '',
      protect: '',
      notes: '',
      createdAt: '2026-04-20T08:00:00.000Z',
      updatedAt: '2026-04-20T08:00:00.000Z',
      syncState: 'pending',
    },
    currentDay: {
      date: '2026-04-20',
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
      createdAt: '2026-04-20T08:00:00.000Z',
      updatedAt: '2026-04-20T08:00:00.000Z',
      syncState: 'pending',
    },
    settings: {
      id: 'settings',
      schemaVersion: SCHEMA_VERSION,
      direction: '',
      standards: '',
      why: '',
      createdAt: '2026-04-20T08:00:00.000Z',
      updatedAt: '2026-04-20T08:00:00.000Z',
      syncState: 'pending',
    },
    routines: [],
    syncState: {
      id: 'sync',
      schemaVersion: SCHEMA_VERSION,
      provider: 'supabase',
      mode: 'ready',
      lastSyncedAt: null,
      authState: 'signed-out',
      identityState: 'device-guest',
      authPromptState: 'none',
      remoteUserId: null,
      createdAt: '2026-04-20T08:00:00.000Z',
      updatedAt: '2026-04-20T08:00:00.000Z',
    },
  };
}

describe('ReviewView', () => {
  it('opens item matches and lets day matches jump back into Now', () => {
    const onOpenItem = vi.fn();
    const onJumpToDate = vi.fn();

    render(
      <ReviewView
        currentDate="2026-04-20"
        onJumpToDate={onJumpToDate}
        onOpenItem={onOpenItem}
        snapshot={makeSnapshot()}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'coffee' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onOpenItem).toHaveBeenCalledWith('item-1');

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'shipped' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Open day' })[0]);
    expect(onJumpToDate).toHaveBeenCalledWith('2026-04-19');
  });

  it('turns repeating loops into search actions', () => {
    const snapshot = makeSnapshot();
    snapshot.items.push({
      ...snapshot.items[0],
      id: 'item-2',
      scheduledDate: '2026-04-22',
      updatedAt: '2026-04-20T09:00:00.000Z',
    });

    render(
      <ReviewView
        currentDate="2026-04-20"
        onJumpToDate={vi.fn()}
        onOpenItem={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show matches' }));
    expect(screen.getByRole('searchbox')).toHaveValue('Buy coffee');
  });
});
