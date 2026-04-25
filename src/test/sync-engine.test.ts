import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';
import { HOLDFAST_DB_NAME, db } from '@/storage/local/db';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const harness = vi.hoisted(() => {
  const state = {
    clientAvailable: true,
    conflictItemId: null as string | null,
    syncedItemId: null as string | null,
    pullQueryCount: 0,
    remoteItemRows: [] as Array<Record<string, unknown>>,
    beforeItemUpsertResolve: null as null | (() => Promise<void> | void),
  };

  function createQueryClient(table: string) {
    const queryState: {
      table: string;
      selected: string | null;
      mode: 'select' | 'upsert' | 'delete' | null;
      payload: Record<string, unknown> | null;
      filters: Array<[string, unknown]>;
    } = {
      table,
      selected: null,
      mode: null,
      payload: null,
      filters: [],
    };

    const resolveRemoteExisting = () => {
      const recordId = queryState.filters.find(([column]) => column === 'id')?.[1];
      if (queryState.table !== 'items' || queryState.selected !== 'server_updated_at') {
        return { data: null, error: null };
      }

      if (recordId === state.conflictItemId) {
        return {
          data: {
            server_updated_at: 'server-item-conflict',
          },
          error: null,
        };
      }

      return { data: null, error: null };
    };

    const resolveUpsert = () => {
      if (queryState.table === 'items' && queryState.payload && harness.state.beforeItemUpsertResolve) {
        return Promise.resolve(harness.state.beforeItemUpsertResolve()).then(() => {
          harness.state.beforeItemUpsertResolve = null;
          return resolveUpsertPayload();
        });
      }

      return Promise.resolve(resolveUpsertPayload());
    };

    const resolveUpsertPayload = () => {
      if (queryState.table === 'items' && queryState.payload?.id === state.syncedItemId) {
        state.remoteItemRows = [
          {
            ...(queryState.payload as Record<string, unknown>),
            server_updated_at: 'server-item-synced',
          },
        ];
        return {
          data: {
            server_updated_at: 'server-item-synced',
          },
          error: null,
        };
      }

      return {
        data: {
          server_updated_at: 'server-item-ignored',
        },
        error: null,
      };
    };

    const resolveAwaited = () => {
      if (queryState.selected === '*') {
        state.pullQueryCount += 1;
        if (queryState.table === 'items') {
          return { data: state.remoteItemRows, error: null };
        }
        return { data: [], error: null };
      }

      if (queryState.mode === 'delete') {
        return { error: null };
      }

      return { data: null, error: null };
    };

    type QueryHarness = {
      select(columns: string): QueryHarness;
      upsert(payload: Record<string, unknown>): QueryHarness;
      delete(): QueryHarness;
      eq(column: string, value: unknown): QueryHarness;
      order(): QueryHarness;
      range(): QueryHarness;
      gte(): QueryHarness;
      maybeSingle(): Promise<unknown>;
      single(): Promise<unknown>;
      then(
        onFulfilled?: ((value: unknown) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ): Promise<unknown>;
    };

    const query: QueryHarness = {
      select(columns: string) {
        queryState.mode = 'select';
        queryState.selected = columns;
        return query;
      },
      upsert(payload: Record<string, unknown>) {
        queryState.mode = 'upsert';
        queryState.payload = payload;
        return query;
      },
      delete() {
        queryState.mode = 'delete';
        return query;
      },
      eq(column: string, value: unknown) {
        queryState.filters.push([column, value]);
        return query;
      },
      order() {
        return query;
      },
      range() {
        return query;
      },
      gte() {
        return query;
      },
      maybeSingle() {
        return Promise.resolve(resolveRemoteExisting());
      },
      single() {
        return resolveUpsert();
      },
      then(
        onFulfilled: ((value: unknown) => unknown) | undefined,
        onRejected: ((reason: unknown) => unknown) | undefined,
      ) {
        return Promise.resolve(resolveAwaited()).then(onFulfilled, onRejected);
      },
    };

    return query;
  }

  const getSessionMock = vi.fn();
  const getCurrentWorkspaceStateMock = vi.fn();
  const getCurrentSyncStateMock = vi.fn();
  const updateSyncStateMock = vi.fn();
  const fromMock = vi.fn((table: string) => createQueryClient(table));

  return {
    state,
    getSessionMock,
    getCurrentWorkspaceStateMock,
    getCurrentSyncStateMock,
    updateSyncStateMock,
    fromMock,
  };
});

vi.mock('@/storage/local/api', async () => {
  const actual = await vi.importActual<typeof import('@/storage/local/api')>(
    '@/storage/local/api',
  );

  return {
    ...actual,
    getCurrentWorkspaceState: harness.getCurrentWorkspaceStateMock,
    getCurrentSyncState: harness.getCurrentSyncStateMock,
    updateSyncState: harness.updateSyncStateMock,
  };
});

vi.mock('@/storage/sync/supabase/client', () => ({
  getSupabaseBrowserClient: () =>
    harness.state.clientAvailable
      ? {
          auth: {
            getSession: harness.getSessionMock,
          },
          from: harness.fromMock,
        }
      : null,
}));

import { createItem } from '@/storage/local/api';
import { saveItem } from '@/storage/local/api';
import { syncHoldfastWithSupabase } from '@/storage/sync/supabase/engine';

async function resetLocalDatabase(): Promise<void> {
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
  await db.open();
}

beforeEach(async () => {
  await resetLocalDatabase();
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    configurable: true,
  });
  harness.state.clientAvailable = true;
  harness.state.conflictItemId = null;
  harness.state.syncedItemId = null;
  harness.state.pullQueryCount = 0;
  harness.state.remoteItemRows = [];
  harness.state.beforeItemUpsertResolve = null;
  harness.getSessionMock.mockReset();
  harness.getCurrentWorkspaceStateMock.mockReset();
  harness.getCurrentSyncStateMock.mockReset();
  harness.updateSyncStateMock.mockReset();
  harness.fromMock.mockClear();
});

afterEach(async () => {
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
});

describe('syncHoldfastWithSupabase', () => {
  it('records a blocked state when the browser client is unavailable', async () => {
    harness.state.clientAvailable = false;

    await expect(syncHoldfastWithSupabase()).resolves.toBeUndefined();

    expect(harness.updateSyncStateMock).toHaveBeenCalledWith({
      blockedReason: 'not-configured',
      mode: 'disabled',
    });
  });

  it('records a blocked state when the device is offline', async () => {
    harness.getCurrentWorkspaceStateMock.mockResolvedValue({
      attachState: 'attached',
      ownershipState: 'member',
      boundUserId: USER_ID,
      authPromptState: 'none',
    });
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    await expect(syncHoldfastWithSupabase()).resolves.toBeUndefined();

    expect(harness.updateSyncStateMock).toHaveBeenCalledWith({
      blockedReason: 'offline',
      mode: 'ready',
    });
  });

  it('keeps action-required member recovery ahead of offline status', async () => {
    harness.getCurrentWorkspaceStateMock.mockResolvedValue({
      attachState: 'attached',
      ownershipState: 'member',
      boundUserId: null,
      authPromptState: 'session-expired',
    });
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    await expect(syncHoldfastWithSupabase()).resolves.toBeUndefined();

    expect(harness.updateSyncStateMock).toHaveBeenCalledWith({
      blockedReason: 'signed-out',
      mode: 'ready',
    });
    expect(harness.getSessionMock).not.toHaveBeenCalled();
  });

  it('keeps wrong-account recovery ahead of offline status', async () => {
    harness.getCurrentWorkspaceStateMock.mockResolvedValue({
      attachState: 'attached',
      ownershipState: 'member',
      boundUserId: USER_ID,
      authPromptState: 'account-mismatch',
    });
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    await expect(syncHoldfastWithSupabase()).resolves.toBeUndefined();

    expect(harness.updateSyncStateMock).toHaveBeenCalledWith({
      blockedReason: 'account-mismatch',
      mode: 'ready',
    });
    expect(harness.getSessionMock).not.toHaveBeenCalled();
  });

  it('records a blocked state for restored work that is not attached yet', async () => {
    harness.getCurrentWorkspaceStateMock.mockResolvedValue({
      attachState: 'detached-restore',
      ownershipState: 'device-guest',
      boundUserId: null,
      authPromptState: 'none',
    });

    await expect(syncHoldfastWithSupabase()).resolves.toBeUndefined();

    expect(harness.updateSyncStateMock).toHaveBeenCalledWith({
      blockedReason: 'detached-restore',
      mode: 'ready',
    });
  });

  it('records a blocked state when there is no signed-in session', async () => {
    harness.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });
    harness.getCurrentWorkspaceStateMock.mockResolvedValue({
      attachState: 'attached',
      ownershipState: 'member',
      boundUserId: USER_ID,
      authPromptState: 'none',
    });

    await expect(syncHoldfastWithSupabase()).resolves.toBeUndefined();

    expect(harness.updateSyncStateMock).toHaveBeenCalledWith({
      blockedReason: 'signed-out',
      mode: 'ready',
    });
  });

  it('records a blocked state when the signed-in account does not match the bound workspace owner', async () => {
    harness.getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: '22222222-2222-4222-8222-222222222222',
          },
        },
      },
      error: null,
    });
    harness.getCurrentWorkspaceStateMock.mockResolvedValue({
      attachState: 'attached',
      ownershipState: 'member',
      boundUserId: USER_ID,
      authPromptState: 'none',
    });

    await expect(syncHoldfastWithSupabase()).resolves.toBeUndefined();

    expect(harness.updateSyncStateMock).toHaveBeenCalledWith({
      blockedReason: 'account-mismatch',
      mode: 'ready',
    });
  });

  it('continues after a conflicted mutation, marks it failed, and still completes the pull', async () => {
    harness.getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: USER_ID,
          },
        },
      },
      error: null,
    });
    harness.getCurrentWorkspaceStateMock.mockResolvedValue({
      attachState: 'attached',
      ownershipState: 'member',
      boundUserId: USER_ID,
      authPromptState: 'none',
    });
    harness.getCurrentSyncStateMock.mockResolvedValue({
      lastSyncedAt: null,
      pullCursorByStream: createDefaultSyncPullCursorMap(),
    });

    await createItem({
      title: 'Needs review',
      kind: 'task',
      lane: 'admin',
      status: 'inbox',
      body: '',
      sourceText: null,
      sourceItemId: null,
      captureMode: null,
      sourceDate: '2026-04-19',
      scheduledDate: null,
      scheduledTime: null,
    });

    const firstItem = (await db.items.toArray())[0]!;
    harness.state.conflictItemId = firstItem!.id;

    await createItem({
      title: 'Sync cleanly',
      kind: 'task',
      lane: 'admin',
      status: 'inbox',
      body: '',
      sourceText: null,
      sourceItemId: null,
      captureMode: null,
      sourceDate: '2026-04-19',
      scheduledDate: null,
      scheduledTime: null,
    });

    const items = await db.items.toArray();
    harness.state.syncedItemId = items.find(
      (item) => item.id !== firstItem.id,
    )!.id;

    await expect(syncHoldfastWithSupabase()).resolves.toBeUndefined();

    const mutationQueue = await db.mutationQueue.toArray();
    const conflictedMutation = mutationQueue.find(
      (mutation) => mutation.entityId === harness.state.conflictItemId,
    );
    const syncedMutation = mutationQueue.find(
      (mutation) => mutation.entityId === harness.state.syncedItemId,
    );
    const conflictedItem = await db.items.get(harness.state.conflictItemId!);
    const syncedItem = await db.items.get(harness.state.syncedItemId!);

    expect(conflictedMutation).toMatchObject({
      status: 'failed',
      lastError: 'A newer version already exists in sync. Review it before sending this change again.',
    });
    expect(syncedMutation).toMatchObject({
      status: 'acknowledged',
      lastError: null,
    });
    expect(conflictedItem).toMatchObject({
      syncState: 'conflict',
      remoteRevision: 'server-item-conflict',
    });
    expect(syncedItem).toMatchObject({
      syncState: 'synced',
      remoteRevision: 'server-item-synced',
    });
    expect(harness.state.pullQueryCount).toBeGreaterThan(0);
    expect(harness.updateSyncStateMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        blockedReason: null,
        mode: 'syncing',
      }),
    );
    expect(harness.updateSyncStateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        blockedReason: null,
        lastFailureAt: expect.any(String),
        lastTransportError: null,
        mode: 'error',
        lastSyncedAt: expect.any(String),
        pullCursorByStream: expect.any(Object),
      }),
    );
  });

  it('keeps a newer local edit pending when an older in-flight item write finishes', async () => {
    harness.getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: USER_ID,
          },
        },
      },
      error: null,
    });
    harness.getCurrentWorkspaceStateMock.mockResolvedValue({
      attachState: 'attached',
      ownershipState: 'member',
      boundUserId: USER_ID,
      authPromptState: 'none',
    });
    harness.getCurrentSyncStateMock.mockResolvedValue({
      lastSyncedAt: null,
      pullCursorByStream: createDefaultSyncPullCursorMap(),
    });

    await createItem({
      title: 'Base item',
      kind: 'task',
      lane: 'admin',
      status: 'inbox',
      body: '',
      sourceText: null,
      sourceItemId: null,
      captureMode: null,
      sourceDate: '2026-04-19',
      scheduledDate: null,
      scheduledTime: null,
    });

    const baseItem = (await db.items.toArray())[0]!;
    harness.state.syncedItemId = baseItem.id;
    harness.state.remoteItemRows = [
      {
        user_id: USER_ID,
        id: baseItem.id,
        schema_version: 5,
        title: 'Base item',
        kind: 'task',
        lane: 'admin',
        status: 'inbox',
        body: '',
        source_text: null,
        source_item_id: null,
        capture_mode: null,
        source_date: '2026-04-19',
        scheduled_date: null,
        scheduled_time: null,
        routine_id: null,
        completed_at: null,
        archived_at: null,
        created_at: baseItem.createdAt,
        updated_at: baseItem.updatedAt,
        deleted_at: null,
        server_updated_at: 'server-item-synced',
      },
    ];
    harness.state.beforeItemUpsertResolve = async () => {
      await saveItem(baseItem.id, {
        title: 'Locally changed later',
        kind: 'task',
        lane: 'admin',
        status: 'inbox',
        body: '',
        scheduledDate: null,
        scheduledTime: null,
      });
    };

    await expect(syncHoldfastWithSupabase()).resolves.toBeUndefined();

    const syncedItem = await db.items.get(baseItem.id);
    const itemMutations = (await db.mutationQueue.toArray()).filter(
      (mutation) => mutation.entity === 'item' && mutation.entityId === baseItem.id,
    );

    expect(syncedItem).toMatchObject({
      title: 'Locally changed later',
      syncState: 'synced',
      remoteRevision: 'server-item-synced',
    });
    expect(itemMutations).toHaveLength(2);
    expect(itemMutations.map((mutation) => mutation.status)).toEqual([
      'acknowledged',
      'acknowledged',
    ]);
    expect(harness.state.pullQueryCount).toBeGreaterThan(0);
  });
});
