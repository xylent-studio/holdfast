import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { NowView } from '@/features/now/NowView';
import type { HoldfastSnapshot } from '@/storage/local/api';

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

function makeSnapshot(): HoldfastSnapshot {
  return {
    currentDate: '2026-04-20',
    items: [],
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
        launchNote: '',
        closeWin: 'Shipped something hard',
        closeCarry: 'Buy batteries',
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

describe('NowView', () => {
  it('keeps day tools secondary and only surfaces yesterday seed inline', () => {
    render(
      <NowView
        currentDate="2026-04-20"
        onOpenItem={vi.fn()}
        snapshot={makeSnapshot()}
      />,
    );

    expect(screen.getByText('Next start | Start with coffee')).toBeInTheDocument();
    expect(screen.queryByText('Buy batteries')).not.toBeInTheDocument();
    expect(screen.queryByText('Water')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open day tools' }));

    expect(screen.getByText('Water')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start day' })).toBeInTheDocument();
  });
});
