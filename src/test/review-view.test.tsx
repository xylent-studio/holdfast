import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { ReviewView } from '@/features/review/ReviewView';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

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
        remoteRevision: null,
        attachments: [],
      },
    ],
    lists: [
      {
        id: 'list-1',
        schemaVersion: SCHEMA_VERSION,
        title: 'Groceries',
        kind: 'replenishment',
        lane: 'home',
        pinned: true,
        sourceItemId: null,
        archivedAt: null,
        createdAt: '2026-04-20T08:00:00.000Z',
        updatedAt: '2026-04-20T09:00:00.000Z',
        deletedAt: null,
        syncState: 'pending',
        remoteRevision: null,
      },
    ],
    listItems: [
      {
        id: 'list-item-1',
        schemaVersion: SCHEMA_VERSION,
        listId: 'list-1',
        title: 'Eggs',
        body: 'Check pantry first',
        status: 'open',
        position: 0,
        sourceItemId: null,
        nowDate: null,
        completedAt: null,
        archivedAt: null,
        createdAt: '2026-04-20T08:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
        deletedAt: null,
        syncState: 'pending',
        remoteRevision: null,
      },
    ],
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
        remoteRevision: null,
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
        remoteRevision: null,
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
      remoteRevision: null,
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
      remoteRevision: null,
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
      remoteRevision: null,
    },
    routines: [],
    syncState: {
      id: 'sync',
      schemaVersion: SCHEMA_VERSION,
      provider: 'supabase',
      mode: 'ready',
      lastSyncedAt: null,
      pullCursorByStream: createDefaultSyncPullCursorMap(),
      createdAt: '2026-04-20T08:00:00.000Z',
      updatedAt: '2026-04-20T08:00:00.000Z',
    },
    workspaceState: {
      id: 'workspace',
      schemaVersion: SCHEMA_VERSION,
      ownershipState: 'device-guest',
      boundUserId: null,
      authPromptState: 'none',
      attachState: 'attached',
      createdAt: '2026-04-20T08:00:00.000Z',
      updatedAt: '2026-04-20T08:00:00.000Z',
    },
  };
}

describe('ReviewView', () => {
  it('opens item matches and lets day matches jump back into Now', () => {
    const onOpenItem = vi.fn();
    const onJumpToDate = vi.fn();
    const onOpenList = vi.fn();

    render(
      <ReviewView
        currentDate="2026-04-20"
        onJumpToDate={onJumpToDate}
        onOpenList={onOpenList}
        onOpenItem={onOpenItem}
        snapshot={makeSnapshot()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'coffee' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onOpenItem).toHaveBeenCalledWith('item-1');

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'shipped' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Open day' })[0]);
    expect(onJumpToDate).toHaveBeenCalledWith('2026-04-19');
  });

  it('keeps Review retrieval-first instead of showing list-creation controls', async () => {
    render(
      <ReviewView
        currentDate="2026-04-20"
        onJumpToDate={vi.fn()}
        onOpenList={vi.fn()}
        onOpenItem={vi.fn()}
        snapshot={makeSnapshot()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'New list' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review' })).toBeVisible();
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
        onOpenList={vi.fn()}
        onOpenItem={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show matches' }));
    expect(screen.getByLabelText('Search')).toHaveValue('Buy coffee');
  });

  it('keeps secondary history and pattern aids collapsed by default', () => {
    render(
      <ReviewView
        currentDate="2026-04-20"
        onJumpToDate={vi.fn()}
        onOpenList={vi.fn()}
        onOpenItem={vi.fn()}
        snapshot={makeSnapshot()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'More trails' })).toBeVisible();
    expect(
      screen.getByText(
        'Search stays primary. Open this only when you need a wider trail.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Recent days' }),
    ).not.toBeInTheDocument();
  });

  it('surfaces lists in review and lets the user open the real list surface', () => {
    const onOpenList = vi.fn();

    render(
      <ReviewView
        currentDate="2026-04-20"
        onJumpToDate={vi.fn()}
        onOpenList={onOpenList}
        onOpenItem={vi.fn()}
        snapshot={makeSnapshot()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'groceries' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Open list' })[0]);

    expect(onOpenList).toHaveBeenCalled();
    expect(onOpenList.mock.calls[0]?.[0]).toBe('list-1');
  });

  it('surfaces conflicted records as needs-attention work', () => {
    const snapshot = makeSnapshot();
    snapshot.items[0] = {
      ...snapshot.items[0],
      syncState: 'conflict',
    };

    render(
      <ReviewView
        currentDate="2026-04-20"
        onJumpToDate={vi.fn()}
        onOpenList={vi.fn()}
        onOpenItem={vi.fn()}
        snapshot={snapshot}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
    expect(
      screen.getByText(
        'Something changed in two places. Open it and decide what still matters before you keep moving.',
      ),
    ).toBeVisible();
    expect(screen.getAllByText('Needs attention').length).toBeGreaterThan(0);
  });
});
