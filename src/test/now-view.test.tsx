import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { NowView } from '@/features/now/NowView';
import type { HoldfastSnapshot } from '@/storage/local/api';
import type { ItemWithAttachments } from '@/storage/local/api';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

const startDayMock = vi.fn();
const seedLaunchFromYesterdayMock = vi.fn();
const toggleFocusMock = vi.fn();
const toggleReadinessMock = vi.fn();
const toggleTaskDoneMock = vi.fn();

vi.mock('@/storage/local/api', async () => {
  const actual = await vi.importActual<typeof import('@/storage/local/api')>(
    '@/storage/local/api',
  );

  return {
    ...actual,
    seedLaunchFromYesterday: (...args: unknown[]) =>
      seedLaunchFromYesterdayMock(...args),
    startDay: (...args: unknown[]) => startDayMock(...args),
    toggleFocus: (...args: unknown[]) => toggleFocusMock(...args),
    toggleReadiness: (...args: unknown[]) => toggleReadinessMock(...args),
    toggleTaskDone: (...args: unknown[]) => toggleTaskDoneMock(...args),
  };
});

function makeItem(
  overrides: Partial<ItemWithAttachments>,
): ItemWithAttachments {
  return {
    attachments: [],
    body: '',
    captureMode: null,
    createdAt: '2026-04-20T08:00:00.000Z',
    deletedAt: null,
    id: crypto.randomUUID(),
    kind: 'task',
    lane: 'admin',
    routineId: null,
    schemaVersion: SCHEMA_VERSION,
    scheduledDate: null,
    scheduledTime: null,
    sourceDate: '2026-04-20',
    sourceItemId: null,
    sourceText: null,
    completedAt: null,
    archivedAt: null,
    status: 'today',
    syncState: 'pending',
    remoteRevision: null,
    title: 'Untitled',
    updatedAt: '2026-04-20T08:00:00.000Z',
    ...overrides,
  };
}

function makeSnapshot(items: ItemWithAttachments[] = []): HoldfastSnapshot {
  return {
    currentDate: '2026-04-20',
    items,
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
        focusListIds: [],
        launchNote: '',
        closeWin: 'Shipped something hard',
        closeCarry: 'Buy batteries',
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
        focusListIds: [],
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
      focusListIds: [],
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

describe('NowView', () => {
  it('keeps day support out of the main surface and only surfaces yesterday seed inline', () => {
    render(
      <NowView
        currentDate="2026-04-20"
        onOpenItem={vi.fn()}
        onOpenList={vi.fn()}
        snapshot={makeSnapshot()}
      />,
    );

    expect(screen.getByText('Next start | Start with coffee')).toBeInTheDocument();
    expect(screen.queryByText('Buy batteries')).not.toBeInTheDocument();
    expect(screen.queryByText('Water')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Day tools' }),
    ).not.toBeInTheDocument();
  });

  it('keeps due-today planned work in Now, future work out of Now, and removes Next up', () => {
    render(
      <NowView
        currentDate="2026-04-20"
        onOpenItem={vi.fn()}
        onOpenList={vi.fn()}
        snapshot={makeSnapshot([
          makeItem({
            title: 'Due today',
            status: 'upcoming',
            scheduledDate: '2026-04-20',
          }),
          makeItem({
            title: 'Future',
            status: 'upcoming',
            scheduledDate: '2026-04-21',
          }),
          makeItem({
            title: 'Overdue',
            status: 'upcoming',
            scheduledDate: '2026-04-19',
          }),
        ])}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Due today' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Focus /i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Future')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Next up' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByRole('button', { name: 'Bring to Now' })).toBeInTheDocument();
  });

  it('shows focused whole lists separately from list-item promotions', () => {
    const snapshot = makeSnapshot();
    snapshot.lists = [
      {
        id: 'list-1',
        schemaVersion: SCHEMA_VERSION,
        title: 'Groceries',
        kind: 'replenishment',
        lane: 'home',
        pinned: false,
        sourceItemId: null,
        scheduledDate: '2026-04-20',
        scheduledTime: null,
        completedAt: null,
        archivedAt: null,
        createdAt: '2026-04-20T08:00:00.000Z',
        updatedAt: '2026-04-20T08:00:00.000Z',
        deletedAt: null,
        syncState: 'pending',
        remoteRevision: null,
      },
    ];
    snapshot.listItems = [
      {
        id: 'list-item-1',
        schemaVersion: SCHEMA_VERSION,
        listId: 'list-1',
        title: 'Eggs',
        body: '',
        status: 'open',
        position: 0,
        sourceItemId: null,
        nowDate: '2026-04-20',
        completedAt: null,
        archivedAt: null,
        createdAt: '2026-04-20T08:00:00.000Z',
        updatedAt: '2026-04-20T08:00:00.000Z',
        deletedAt: null,
        syncState: 'pending',
        remoteRevision: null,
      },
    ];
    snapshot.currentDay.focusListIds = ['list-1'];

    render(
      <NowView
        currentDate="2026-04-20"
        onOpenItem={vi.fn()}
        onOpenList={vi.fn()}
        snapshot={snapshot}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Lists in play' })).toBeInTheDocument();
    expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
    expect(screen.getByText('From lists')).toBeInTheDocument();
    expect(screen.getByText('Eggs')).toBeInTheDocument();
  });
});
