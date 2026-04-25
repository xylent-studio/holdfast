import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { InboxView } from '@/features/inbox/InboxView';
import type {
  HoldfastSnapshot,
  ItemWithAttachments,
} from '@/storage/local/api';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

function makeCaptureItem(): ItemWithAttachments {
  return {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    title: 'Receipt and reminder',
    kind: 'capture',
    lane: 'admin',
    status: 'inbox',
    body: 'Keep this safe for later',
    sourceText: 'Receipt and reminder\n\nKeep this safe for later',
    sourceItemId: null,
    captureMode: 'uncertain',
    sourceDate: '2026-04-19',
    scheduledDate: null,
    scheduledTime: null,
    routineId: null,
    completedAt: null,
    archivedAt: null,
    createdAt: '2026-04-19T08:00:00.000Z',
    updatedAt: '2026-04-19T08:00:00.000Z',
    deletedAt: null,
    syncState: 'pending',
    remoteRevision: null,
    attachments: [],
  };
}

function makeSnapshot(item: ItemWithAttachments): HoldfastSnapshot {
  return {
    currentDate: '2026-04-19',
    items: [item],
    lists: [],
    listItems: [],
    dailyRecords: [
      {
        date: '2026-04-19',
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
        createdAt: '2026-04-19T08:00:00.000Z',
        updatedAt: '2026-04-19T08:00:00.000Z',
        syncState: 'pending',
        remoteRevision: null,
      },
    ],
    weeklyRecord: {
      weekStart: '2026-04-13',
      schemaVersion: SCHEMA_VERSION,
      focus: '',
      protect: '',
      notes: '',
      createdAt: '2026-04-13T08:00:00.000Z',
      updatedAt: '2026-04-19T08:00:00.000Z',
      syncState: 'pending',
      remoteRevision: null,
    },
    currentDay: {
      date: '2026-04-19',
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
      createdAt: '2026-04-19T08:00:00.000Z',
      updatedAt: '2026-04-19T08:00:00.000Z',
      syncState: 'pending',
      remoteRevision: null,
    },
    settings: {
      id: 'settings',
      schemaVersion: SCHEMA_VERSION,
      direction: '',
      standards: '',
      why: '',
      createdAt: '2026-04-19T08:00:00.000Z',
      updatedAt: '2026-04-19T08:00:00.000Z',
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
      createdAt: '2026-04-19T08:00:00.000Z',
      updatedAt: '2026-04-19T08:00:00.000Z',
    },
    workspaceState: {
      id: 'workspace',
      schemaVersion: SCHEMA_VERSION,
      ownershipState: 'device-guest',
      boundUserId: null,
      authPromptState: 'none',
      attachState: 'attached',
      createdAt: '2026-04-19T08:00:00.000Z',
      updatedAt: '2026-04-19T08:00:00.000Z',
    },
  };
}

describe('InboxView', () => {
  it('shows the inline placement strip for captures and hides task completion controls', () => {
    render(
      <InboxView
        currentDate="2026-04-19"
        onOpenItem={vi.fn()}
        snapshot={makeSnapshot(makeCaptureItem())}
      />,
    );

    expect(screen.getByText('Place it')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep undated' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Complete task/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Capture')).not.toHaveLength(0);
  });

  it('stays scoped to Inbox items instead of leaking all open work', () => {
    const inboxItem = makeCaptureItem();
    const nowItem: ItemWithAttachments = {
      ...makeCaptureItem(),
      id: crypto.randomUUID(),
      title: 'Already in Now',
      kind: 'task',
      status: 'today',
      captureMode: null,
      sourceText: null,
    };

    render(
      <InboxView
        currentDate="2026-04-19"
        onOpenItem={vi.fn()}
        snapshot={{
          ...makeSnapshot(inboxItem),
          items: [inboxItem, nowItem],
        }}
      />,
    );

    expect(screen.getByText('Receipt and reminder')).toBeInTheDocument();
    expect(screen.queryByText('Already in Now')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'All open' }),
    ).not.toBeInTheDocument();
  });
});
