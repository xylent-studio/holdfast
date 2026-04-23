import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { UpcomingView } from '@/features/upcoming/UpcomingView';
import type {
  HoldfastSnapshot,
  ItemWithAttachments,
} from '@/storage/local/api';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

function makeItem(overrides: Partial<ItemWithAttachments>): ItemWithAttachments {
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
    status: 'upcoming',
    syncState: 'pending',
    remoteRevision: null,
    title: 'Untitled',
    updatedAt: '2026-04-20T08:00:00.000Z',
    ...overrides,
  };
}

function makeSnapshot(items: ItemWithAttachments[]): HoldfastSnapshot {
  return {
    currentDate: '2026-04-20',
    items,
    lists: [],
    listItems: [],
    dailyRecords: [],
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

function renderUpcoming(initialEntry = '/upcoming') {
  const snapshot = makeSnapshot([
    makeItem({
      title: 'Due today',
      scheduledDate: '2026-04-20',
    }),
    makeItem({
      title: 'Tomorrow',
      scheduledDate: '2026-04-21',
    }),
    makeItem({
      title: 'Undated',
      scheduledDate: null,
    }),
    makeItem({
      title: 'Waiting',
      status: 'waiting',
      scheduledDate: null,
    }),
  ]);

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/upcoming"
          element={
            <UpcomingView
              currentDate="2026-04-20"
              onOpenItem={vi.fn()}
              snapshot={snapshot}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UpcomingView', () => {
  it('defaults to scheduled and keeps due-today work out of Upcoming', () => {
    renderUpcoming();

    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.queryByText('Due today')).not.toBeInTheDocument();
  });

  it('uses the url-backed section filter and lets the user switch sections', () => {
    renderUpcoming('/upcoming?section=undated');

    expect(screen.getByRole('heading', { name: 'Undated' })).toBeInTheDocument();
    expect(screen.queryByText('Tomorrow')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Waiting on (1)' }));

    expect(screen.getByRole('heading', { name: 'Waiting' })).toBeInTheDocument();
  });
});
