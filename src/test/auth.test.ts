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
      authPromptState: 'none',
      remoteUserId: null,
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
    snapshot.syncState = {
      ...snapshot.syncState,
      identityState: 'member',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(
      hasAuthOwnerMismatch(
        snapshot.syncState,
        '22222222-2222-4222-8222-222222222222',
      ),
    ).toBe(true);
    expect(
      hasAuthOwnerMismatch(
        snapshot.syncState,
        '11111111-1111-4111-8111-111111111111',
      ),
    ).toBe(false);
  });

  it('builds signed-in and signed-out auth patches without touching sync mode', () => {
    const snapshot = makeSnapshot();
    snapshot.syncState = {
      ...snapshot.syncState,
      identityState: 'member',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(
      signedInAuthPatch('33333333-3333-4333-8333-333333333333'),
    ).toMatchObject({
      authState: 'signed-in',
      identityState: 'member',
      authPromptState: 'none',
      remoteUserId: '33333333-3333-4333-8333-333333333333',
    });
    expect(
      signedOutAuthPatch(snapshot.syncState, 'signed-out-by-user'),
    ).toMatchObject({
      authState: 'signed-out',
      identityState: 'member',
      authPromptState: 'signed-out-by-user',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('keeps member prompt states sticky across later signed-out sync passes', () => {
    const snapshot = makeSnapshot();
    snapshot.syncState = {
      ...snapshot.syncState,
      identityState: 'member',
      authPromptState: 'account-mismatch',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(resolveSignedOutAuthPromptState(snapshot.syncState, null)).toBe(
      'account-mismatch',
    );

    snapshot.syncState = {
      ...snapshot.syncState,
      authPromptState: 'signed-out-by-user',
    };

    expect(resolveSignedOutAuthPromptState(snapshot.syncState, null)).toBe(
      'signed-out-by-user',
    );
  });

  it('falls back to session-expired when a member workspace loses session state without a prior prompt', () => {
    const snapshot = makeSnapshot();
    snapshot.syncState = {
      ...snapshot.syncState,
      identityState: 'member',
      authPromptState: 'none',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(resolveSignedOutAuthPromptState(snapshot.syncState, null)).toBe(
      'session-expired',
    );
    expect(
      resolveSignedOutAuthPromptState(
        snapshot.syncState,
        'account-mismatch',
      ),
    ).toBe('account-mismatch');
  });
});

describe('shouldShowSessionRecovery', () => {
  it('suppresses the recovery panel after an explicit sign-out', () => {
    const snapshot = makeSnapshot();
    snapshot.syncState = {
      ...snapshot.syncState,
      identityState: 'member',
      authPromptState: 'signed-out-by-user',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(shouldShowSessionRecovery(snapshot.syncState, false)).toBe(false);
  });

  it('shows recovery when member-owned local work loses its session', () => {
    const snapshot = makeSnapshot();
    snapshot.syncState = {
      ...snapshot.syncState,
      identityState: 'member',
      authPromptState: 'session-expired',
      remoteUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(shouldShowSessionRecovery(snapshot.syncState, false)).toBe(true);
    expect(shouldShowSessionRecovery(snapshot.syncState, true)).toBe(false);
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
