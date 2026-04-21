import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { SettingsView } from '@/features/settings/SettingsView';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

const retrySyncMock = vi.fn();
const signOutMock = vi.fn();
const updateSettingsMock = vi.fn();
const updateWeeklyRecordMock = vi.fn();
let mockedSession: { user: { id: string } } | null = {
  user: { id: 'user-1' },
};
let mockedEmail = 'justin@example.com';
let mockedDisplayName: string | null = 'Justin';
let mockedProviderLabel: string | null = 'Google';

vi.mock('@/app/auth/useAuth', () => ({
  useAuth: () => ({
    configured: true,
    displayName: mockedDisplayName,
    email: mockedEmail,
    providerLabel: mockedProviderLabel,
    session: mockedSession,
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
        remoteRevision: null,
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
      direction: 'Ship a calmer daily product.',
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
      ownershipState: 'member',
      boundUserId: '11111111-1111-4111-8111-111111111111',
      authPromptState: 'none',
      attachState: 'attached',
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
    mockedSession = { user: { id: 'user-1' } };
    mockedEmail = 'justin@example.com';
    mockedDisplayName = 'Justin';
    mockedProviderLabel = 'Google';
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]!);
    expect(updateSettingsMock).toHaveBeenCalledWith({
      direction: 'Build the trustworthy version.',
      standards: '',
      why: '',
    });
  });

  it('keeps recovery language grounded for a signed-out member workspace', () => {
    mockedSession = null;
    mockedEmail = '';
    mockedDisplayName = null;
    mockedProviderLabel = null;
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      authPromptState: 'session-expired',
    };

    render(<SettingsView currentDate="2026-04-20" snapshot={snapshot} />);

    expect(
      screen.getByText('Sign in again to keep this device in sync.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We'll keep what's already here and sync it to your account."),
    ).toBeInTheDocument();
    expect(screen.getByText('Signed out on this device')).toBeInTheDocument();
  });

  it('shows the original-account warning when the workspace owner mismatches', () => {
    mockedSession = null;
    mockedEmail = '';
    mockedDisplayName = null;
    mockedProviderLabel = null;
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      authPromptState: 'account-mismatch',
    };

    render(<SettingsView currentDate="2026-04-20" snapshot={snapshot} />);

    expect(
      screen.getByText("This device is still holding another account's workspace."),
    ).toBeInTheDocument();
    expect(screen.getByText('Needs the original account')).toBeInTheDocument();
  });
});
