import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { InboxView } from '@/features/inbox/InboxView';
import type {
  HoldfastSnapshot,
  ItemWithAttachments,
} from '@/storage/local/api';

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
      remoteUserId: null,
      createdAt: '2026-04-19T08:00:00.000Z',
      updatedAt: '2026-04-19T08:00:00.000Z',
    },
  };
}

describe('InboxView', () => {
  it('shows Shape it for captures and hides task completion controls', () => {
    render(
      <InboxView
        currentDate="2026-04-19"
        onOpenItem={vi.fn()}
        snapshot={makeSnapshot(makeCaptureItem())}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Shape it' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Complete task/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Capture')).not.toHaveLength(0);
  });
});
