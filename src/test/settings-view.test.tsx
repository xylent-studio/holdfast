import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { SettingsView } from '@/features/settings/SettingsView';
import type { HoldfastSnapshot } from '@/storage/local/api';

const retrySyncMock = vi.fn();
const signOutMock = vi.fn();
const updateSettingsMock = vi.fn();
const updateWeeklyRecordMock = vi.fn();

vi.mock('@/app/auth/useAuth', () => ({
  useAuth: () => ({
    configured: true,
    displayName: 'Justin',
    email: 'justin@example.com',
    providerLabel: 'Google',
    session: {
      user: { id: 'user-1' },
    },
    signOut: signOutMock,
  }),
}));

vi.mock('@/app/sync/useSync', () => ({
  useSync: () => ({
    isOnline: true,
    pendingMutationCount: 0,
    retrySync: retrySyncMock,
  }),
}));

vi.mock('@/storage/local/api', async () => {
  const actual = await vi.importActual<typeof import('@/storage/local/api')>(
    '@/storage/local/api',
  );

  return {
    ...actual,
    updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
    updateWeeklyRecord: (...args: unknown[]) => updateWeeklyRecordMock(...args),
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
      focus: 'Protect the main launch',
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
      direction: 'Ship a calmer daily product.',
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
      authState: 'signed-in',
      identityState: 'member',
      authPromptState: 'none',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-04-20T08:00:00.000Z',
      updatedAt: '2026-04-20T08:00:00.000Z',
    },
  };
}

describe('SettingsView', () => {
  beforeEach(() => {
    retrySyncMock.mockReset();
    signOutMock.mockReset();
    updateSettingsMock.mockReset();
    updateWeeklyRecordMock.mockReset();
  });

  it('keeps advanced sections collapsed until opened', () => {
    render(<SettingsView currentDate="2026-04-20" snapshot={makeSnapshot()} />);

    expect(
      screen.queryByRole('button', { name: 'Add routine' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]);
    expect(
      screen.getByRole('textbox', { name: '12-month direction' }),
    ).toBeInTheDocument();
  });

  it('waits for Save before writing longer-view edits', () => {
    render(<SettingsView currentDate="2026-04-20" snapshot={makeSnapshot()} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]);
    fireEvent.change(screen.getByRole('textbox', { name: '12-month direction' }), {
      target: { value: 'Build the trustworthy version.' },
    });

    expect(updateSettingsMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateSettingsMock).toHaveBeenCalledWith({
      direction: 'Build the trustworthy version.',
      standards: '',
      why: '',
    });
  });
});
