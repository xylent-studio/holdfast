import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { ListView } from '@/features/lists/ListView';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

const createListItemMock = vi.fn();
const createTaskFromListItemMock = vi.fn();
const deleteListItemMock = vi.fn();
const promoteListItemToNowMock = vi.fn();
const replaceListItemWithLatestSavedVersionMock = vi.fn();
const replaceListWithLatestSavedVersionMock = vi.fn();
const updateListMock = vi.fn();
const updateListItemMock = vi.fn();

vi.mock('@/storage/local/api', () => ({
  createListItem: (...args: unknown[]) => createListItemMock(...args),
  createTaskFromListItem: (...args: unknown[]) =>
    createTaskFromListItemMock(...args),
  deleteListItem: (...args: unknown[]) => deleteListItemMock(...args),
  promoteListItemToNow: (...args: unknown[]) => promoteListItemToNowMock(...args),
  replaceListItemWithLatestSavedVersion: (...args: unknown[]) =>
    replaceListItemWithLatestSavedVersionMock(...args),
  replaceListWithLatestSavedVersion: (...args: unknown[]) =>
    replaceListWithLatestSavedVersionMock(...args),
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
    promoteListItemToNowMock.mockReset();
    replaceListItemWithLatestSavedVersionMock.mockReset();
    replaceListWithLatestSavedVersionMock.mockReset();
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
});
