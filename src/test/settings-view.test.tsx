import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { SettingsView } from '@/features/settings/SettingsView';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

const retrySyncMock = vi.fn();
const signOutMock = vi.fn();
const removeDataFromDeviceMock = vi.fn();
const updateSettingsMock = vi.fn();
const updateWeeklyRecordMock = vi.fn();
let mockedIsOnline = true;
let mockedFailedMutationCount = 0;
let mockedPendingMutationCount = 0;
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
    failedMutationCount: mockedFailedMutationCount,
    isOnline: mockedIsOnline,
    pendingMutationCount: mockedPendingMutationCount,
    retrySync: retrySyncMock,
  }),
}));

vi.mock('@/app/runtime/useRuntimeDiagnostics', () => ({
  useRuntimeDiagnostics: () => ({
    activeServiceWorkerBuildId: 'test-build',
    buildId: 'test-build',
    supabaseHost: 'acpaqcdttgdofwcsnhxf.supabase.co',
  }),
}));

vi.mock('@/storage/local/api', async () => {
  const actual = await vi.importActual<typeof import('@/storage/local/api')>(
    '@/storage/local/api',
  );

  return {
    ...actual,
    removeDataFromDevice: (...args: unknown[]) =>
      removeDataFromDeviceMock(...args),
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
      blockedReason: null,
      lastFailureAt: null,
      lastTransportError: null,
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

function panelFor(title: string): HTMLElement {
  return screen.getByRole('heading', { name: title }).closest('.panel')!;
}

describe('SettingsView', () => {
  beforeEach(() => {
    retrySyncMock.mockReset();
    signOutMock.mockReset();
    removeDataFromDeviceMock.mockReset();
    updateSettingsMock.mockReset();
    updateWeeklyRecordMock.mockReset();
    mockedFailedMutationCount = 0;
    mockedIsOnline = true;
    mockedPendingMutationCount = 0;
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

    fireEvent.click(
      within(panelFor('Private notes')).getByRole('button', { name: 'Open' }),
    );
    expect(
      screen.getByRole('textbox', { name: '12-month direction' }),
    ).toBeInTheDocument();
  });

  it('waits for Save before writing longer-view edits', () => {
    render(<SettingsView currentDate="2026-04-20" snapshot={makeSnapshot()} />);

    fireEvent.click(
      within(panelFor('Private notes')).getByRole('button', { name: 'Open' }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: '12-month direction' }), {
      target: { value: 'Build the trustworthy version.' },
    });

    expect(updateSettingsMock).not.toHaveBeenCalled();

    fireEvent.click(
      within(panelFor('Private notes')).getAllByRole('button', { name: 'Save' })[0]!,
    );
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
    snapshot.syncState = {
      ...snapshot.syncState,
      blockedReason: 'signed-out',
    };

    render(<SettingsView currentDate="2026-04-20" snapshot={snapshot} />);

    expect(screen.getAllByText('Sign in again to keep this device in sync.')).toHaveLength(2);
    expect(
      screen.getByText("We'll keep what's already here and attach it to your account here first."),
    ).toBeInTheDocument();
    expect(screen.getByText("Can't sync yet")).toBeInTheDocument();
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
    snapshot.syncState = {
      ...snapshot.syncState,
      blockedReason: 'account-mismatch',
    };

    render(<SettingsView currentDate="2026-04-20" snapshot={snapshot} />);

    expect(
      screen.getAllByText("This device is still holding another account's workspace."),
    ).toHaveLength(2);
    expect(screen.getByText("Can't sync yet")).toBeInTheDocument();
  });

  it('offers a separate remove-data action for this device', async () => {
    const confirmMock = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(true);
    signOutMock.mockResolvedValue(undefined);
    removeDataFromDeviceMock.mockResolvedValue(undefined);

    render(<SettingsView currentDate="2026-04-20" snapshot={makeSnapshot()} />);

    fireEvent.click(
      within(panelFor('Workspace safety')).getByRole('button', { name: 'Open' }),
    );
    const removeButton = await screen.findByRole('button', {
      name: 'Remove data from this device',
    });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
      expect(removeDataFromDeviceMock).toHaveBeenCalled();
    });

    confirmMock.mockRestore();
  });

  it('uses the syncing label while local changes are still catching up', () => {
    const snapshot = makeSnapshot();

    mockedPendingMutationCount = 2;
    snapshot.syncState = {
      ...snapshot.syncState,
      lastSyncedAt: '2026-04-20T09:00:00.000Z',
    };
    render(<SettingsView currentDate="2026-04-20" snapshot={snapshot} />);

    expect(screen.getByText('Syncing...')).toBeInTheDocument();
    expect(
      screen.getByText('This device is catching up quietly in the background.'),
    ).toBeInTheDocument();
  });

  it('uses the saved-offline label only for blocked offline sync', () => {
    const snapshot = makeSnapshot();
    mockedIsOnline = false;
    snapshot.syncState = {
      ...snapshot.syncState,
      blockedReason: 'offline',
    };

    render(<SettingsView currentDate="2026-04-20" snapshot={snapshot} />);

    expect(screen.getByText('Saved offline')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Local work is safe here and will catch up when this device reconnects.',
      ),
    ).toBeInTheDocument();
  });

  it('uses the degraded label and retry action when sync actually failed', () => {
    const snapshot = makeSnapshot();
    mockedFailedMutationCount = 1;
    snapshot.syncState = {
      ...snapshot.syncState,
      mode: 'error',
      lastTransportError: 'Network stalled during sync.',
    };

    render(<SettingsView currentDate="2026-04-20" snapshot={snapshot} />);

    expect(screen.getByText("Couldn't sync yet")).toBeInTheDocument();
    expect(screen.getByText('Network stalled during sync.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
