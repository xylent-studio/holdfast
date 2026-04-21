import { describe, expect, it } from 'vitest';

import {
  hasAuthOwnerMismatch,
  resolveSignedOutAuthPromptState,
  signedInAuthPatch,
  signedOutAuthPatch,
} from '@/app/auth/sync-state';
import { shouldShowAuthLanding } from '@/app/auth/gating';
import { shouldShowSessionRecovery } from '@/app/auth/recovery';
import { hasMeaningfulLocalState } from '@/app/auth/workspace';
import { SCHEMA_VERSION } from '@/domain/constants';
import { normalizeAuthNextPath } from '@/storage/sync/supabase/auth';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { createDefaultSyncPullCursorMap } from '@/storage/sync/state';

function makeSnapshot(): HoldfastSnapshot {
  return {
    currentDate: '2026-04-19',
    items: [],
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

describe('normalizeAuthNextPath', () => {
  it('keeps only safe in-app paths', () => {
    expect(normalizeAuthNextPath('/review')).toBe('/review');
    expect(normalizeAuthNextPath('/auth/callback?next=/now')).toBe('/now');
    expect(normalizeAuthNextPath('https://example.com')).toBe('/now');
    expect(normalizeAuthNextPath('//example.com')).toBe('/now');
    expect(normalizeAuthNextPath(null)).toBe('/now');
  });
});

describe('hasMeaningfulLocalState', () => {
  it('stays false for an untouched local workspace', () => {
    expect(hasMeaningfulLocalState(makeSnapshot())).toBe(false);
  });

  it('turns true when the device already holds real user work', () => {
    const snapshot = makeSnapshot();
    snapshot.dailyRecords[0] = {
      ...snapshot.dailyRecords[0],
      launchNote: 'Carry this into the morning',
    };

    expect(hasMeaningfulLocalState(snapshot)).toBe(true);
  });
});

describe('auth sync state guards', () => {
  it('flags member workspaces that sign into a different account', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(
      hasAuthOwnerMismatch(
        snapshot.workspaceState,
        '22222222-2222-4222-8222-222222222222',
      ),
    ).toBe(true);
    expect(
      hasAuthOwnerMismatch(
        snapshot.workspaceState,
        '11111111-1111-4111-8111-111111111111',
      ),
    ).toBe(false);
  });

  it('builds signed-in and signed-out auth patches without touching sync mode', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(
      signedInAuthPatch('33333333-3333-4333-8333-333333333333'),
    ).toMatchObject({
      ownershipState: 'member',
      authPromptState: 'none',
      boundUserId: '33333333-3333-4333-8333-333333333333',
      attachState: 'attached',
    });
    expect(
      signedOutAuthPatch(snapshot.workspaceState, 'signed-out-by-user'),
    ).toMatchObject({
      ownershipState: 'member',
      authPromptState: 'signed-out-by-user',
      boundUserId: '11111111-1111-4111-8111-111111111111',
      attachState: 'attached',
    });
  });

  it('keeps member prompt states sticky across later signed-out sync passes', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      authPromptState: 'account-mismatch',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(resolveSignedOutAuthPromptState(snapshot.workspaceState, null)).toBe(
      'account-mismatch',
    );

    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      authPromptState: 'signed-out-by-user',
    };

    expect(resolveSignedOutAuthPromptState(snapshot.workspaceState, null)).toBe(
      'signed-out-by-user',
    );
  });

  it('falls back to session-expired when a member workspace loses session state without a prior prompt', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      authPromptState: 'none',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(resolveSignedOutAuthPromptState(snapshot.workspaceState, null)).toBe(
      'session-expired',
    );
    expect(
      resolveSignedOutAuthPromptState(
        snapshot.workspaceState,
        'account-mismatch',
      ),
    ).toBe('account-mismatch');
  });
});

describe('shouldShowSessionRecovery', () => {
  it('suppresses the recovery panel after an explicit sign-out', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      authPromptState: 'signed-out-by-user',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(shouldShowSessionRecovery(snapshot.workspaceState, false)).toBe(
      false,
    );
  });

  it('shows recovery when member-owned local work loses its session', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      authPromptState: 'session-expired',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(shouldShowSessionRecovery(snapshot.workspaceState, false)).toBe(
      true,
    );
    expect(shouldShowSessionRecovery(snapshot.workspaceState, true)).toBe(
      false,
    );
  });
});

describe('shouldShowAuthLanding', () => {
  it('shows the landing for a clean signed-out device', () => {
    expect(
      shouldShowAuthLanding({
        authConfigured: true,
        authReady: true,
        hasLocalData: false,
        hasSession: false,
        shouldShowSessionRecovery: false,
        snapshotReady: true,
      }),
    ).toBe(true);
  });

  it('does not show the landing when a member workspace needs recovery', () => {
    expect(
      shouldShowAuthLanding({
        authConfigured: true,
        authReady: true,
        hasLocalData: false,
        hasSession: false,
        shouldShowSessionRecovery: true,
        snapshotReady: true,
      }),
    ).toBe(false);
  });
});
