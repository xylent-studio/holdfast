import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { ListView } from '@/features/lists/ListView';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

const createListItemMock = vi.fn();
const createTaskFromListItemMock = vi.fn();
const deleteListItemMock = vi.fn();
const finishListMock = vi.fn();
const moveListToNowMock = vi.fn();
const promoteListItemToNowMock = vi.fn();
const replaceListItemWithLatestSavedVersionMock = vi.fn();
const replaceListWithLatestSavedVersionMock = vi.fn();
const scheduleListMock = vi.fn();
const setListFocusMock = vi.fn();
const clearListScheduleMock = vi.fn();
const updateListMock = vi.fn();
const updateListItemMock = vi.fn();

vi.mock('@/storage/local/api', () => ({
  clearListSchedule: (...args: unknown[]) => clearListScheduleMock(...args),
  createListItem: (...args: unknown[]) => createListItemMock(...args),
  createTaskFromListItem: (...args: unknown[]) =>
    createTaskFromListItemMock(...args),
  deleteListItem: (...args: unknown[]) => deleteListItemMock(...args),
  finishList: (...args: unknown[]) => finishListMock(...args),
  moveListToNow: (...args: unknown[]) => moveListToNowMock(...args),
  promoteListItemToNow: (...args: unknown[]) => promoteListItemToNowMock(...args),
  replaceListItemWithLatestSavedVersion: (...args: unknown[]) =>
    replaceListItemWithLatestSavedVersionMock(...args),
  replaceListWithLatestSavedVersion: (...args: unknown[]) =>
    replaceListWithLatestSavedVersionMock(...args),
  scheduleList: (...args: unknown[]) => scheduleListMock(...args),
  setListFocus: (...args: unknown[]) => setListFocusMock(...args),
  updateList: (...args: unknown[]) => updateListMock(...args),
  updateListItem: (...args: unknown[]) => updateListItemMock(...args),
}));

function makeSnapshot(): HoldfastSnapshot {
  return {
    currentDate: '2026-04-20',
    items: [],
    lists: [
      {
        id: 'list-1',
        schemaVersion: SCHEMA_VERSION,
        title: 'Groceries',
        kind: 'replenishment',
        lane: 'home',
        pinned: true,
        sourceItemId: null,
        scheduledDate: null,
        scheduledTime: null,
        completedAt: null,
        archivedAt: null,
        createdAt: '2026-04-20T08:00:00.000Z',
        updatedAt: '2026-04-20T09:00:00.000Z',
        deletedAt: null,
        syncState: 'conflict',
        remoteRevision: 'server-list-2',
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
        syncState: 'conflict',
        remoteRevision: 'server-list-item-2',
      },
    ],
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

describe('ListView', () => {
  beforeEach(() => {
    createListItemMock.mockReset();
    createTaskFromListItemMock.mockReset();
    deleteListItemMock.mockReset();
    finishListMock.mockReset();
    moveListToNowMock.mockReset();
    promoteListItemToNowMock.mockReset();
    replaceListItemWithLatestSavedVersionMock.mockReset();
    replaceListWithLatestSavedVersionMock.mockReset();
    scheduleListMock.mockReset();
    setListFocusMock.mockReset();
    clearListScheduleMock.mockReset();
    updateListMock.mockReset();
    updateListItemMock.mockReset();
  });

  it('surfaces list conflicts and can pull in the latest saved list version', async () => {
    replaceListWithLatestSavedVersionMock.mockResolvedValue(undefined);

    render(
      <ListView
        currentDate="2026-04-20"
        listId="list-1"
        onOpenItem={vi.fn()}
        snapshot={makeSnapshot()}
      />,
    );

    expect(screen.getByText('This list changed in two places.')).toBeVisible();
    expect(screen.getAllByText('Needs attention').length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Use latest saved version' })[0]!,
    );

    await waitFor(() => {
      expect(replaceListWithLatestSavedVersionMock).toHaveBeenCalledWith('list-1');
    });
  });

  it('lets a conflicted list item keep the local version intentionally', async () => {
    updateListItemMock.mockResolvedValue(undefined);

    render(
      <ListView
        currentDate="2026-04-20"
        listId="list-1"
        onOpenItem={vi.fn()}
        snapshot={makeSnapshot()}
      />,
    );

    expect(
      screen.getByText('This list item changed in two places.'),
    ).toBeVisible();

    fireEvent.click(screen.getAllByRole('button', { name: 'Keep this version' })[1]!);

    await waitFor(() => {
      expect(updateListItemMock).toHaveBeenCalledWith('list-item-1', {
        title: 'Eggs',
        body: 'Check pantry first',
        status: 'open',
        position: 0,
        sourceItemId: null,
        nowDate: null,
      });
    });
  });

  it('opens the finish sheet for an active list run', async () => {
    const snapshot = makeSnapshot();
    snapshot.lists[0] = {
      ...snapshot.lists[0]!,
      syncState: 'pending',
      scheduledDate: '2026-04-20',
    };
    snapshot.currentDay.focusListIds = ['list-1'];

    render(
      <ListView
        currentDate="2026-04-20"
        listId="list-1"
        onOpenItem={vi.fn()}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Manage list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish list' }));

    expect(
      screen.getByRole('heading', { name: 'Finish Groceries' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Archive run and reset/i }),
    ).toBeInTheDocument();
  });

  it('hides redundant list-item Bring to Now when the whole list is already active', () => {
    const snapshot = makeSnapshot();
    snapshot.lists[0] = {
      ...snapshot.lists[0]!,
      syncState: 'pending',
      scheduledDate: '2026-04-20',
    };

    render(
      <ListView
        currentDate="2026-04-20"
        listId="list-1"
        onOpenItem={vi.fn()}
        snapshot={snapshot}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Bring to Now' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create task' }),
    ).not.toBeInTheDocument();
  });

  it('opens archived lists as retrieval-only snapshots and focuses matched rows', async () => {
    const snapshot = makeSnapshot();
    snapshot.lists[0] = {
      ...snapshot.lists[0]!,
      archivedAt: '2026-04-20T20:00:00.000Z',
      syncState: 'pending',
    };
    snapshot.listItems[0] = {
      ...snapshot.listItems[0]!,
      status: 'done',
      completedAt: '2026-04-20T19:00:00.000Z',
    };

    render(
      <ListView
        currentDate="2026-04-20"
        highlightListItemId="list-item-1"
        listId="list-1"
        onOpenItem={vi.fn()}
        snapshot={snapshot}
      />,
    );

    expect(screen.getByText('Archived snapshot')).toBeVisible();
    expect(
      screen.getByText(
        'Archived lists stay searchable for reference. They are not active work surfaces.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Manage list' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        document.querySelector('[data-list-item-id="list-item-1"]'),
      ).toHaveFocus();
    });
  });
});
