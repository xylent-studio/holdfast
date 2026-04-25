import { describe, expect, it } from 'vitest';

import {
  hasAuthOwnerMismatch,
  hasUnresolvedMemberOwner,
  resolveSignedOutAuthPromptState,
  signedInAuthPatch,
  signedOutAuthPatch,
} from '@/app/auth/sync-state';
import {
  resolveShellAccessMode,
  shouldWaitForShellAccess,
} from '@/app/auth/gating';
import { shouldShowSessionRecovery } from '@/app/auth/recovery';
import { hasMeaningfulLocalState } from '@/app/auth/workspace';
import { SCHEMA_VERSION } from '@/domain/constants';
import {
  normalizeAuthNextPath,
  parseSupabaseAuthHash,
} from '@/storage/sync/supabase/auth';
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

describe('parseSupabaseAuthHash', () => {
  it('extracts a session from hash tokens', () => {
    expect(
      parseSupabaseAuthHash('#access_token=abc&refresh_token=def&type=signup'),
    ).toEqual({
      accessToken: 'abc',
      refreshToken: 'def',
    });
  });

  it('surfaces auth errors from the hash payload', () => {
    expect(
      parseSupabaseAuthHash('#error=access_denied&error_description=bad+link'),
    ).toEqual({
      error: 'bad link',
    });
  });

  it('ignores unrelated hashes', () => {
    expect(parseSupabaseAuthHash('#hello=world')).toBeNull();
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

  it('flags legacy member workspaces whose owner cannot be proven', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      boundUserId: null,
      authPromptState: 'session-expired',
    };

    expect(hasUnresolvedMemberOwner(snapshot.workspaceState)).toBe(true);

    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(hasUnresolvedMemberOwner(snapshot.workspaceState)).toBe(false);
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
  it('keeps recovery visible for member workspaces even after an explicit sign-out', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      authPromptState: 'signed-out-by-user',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(shouldShowSessionRecovery(snapshot.workspaceState, false)).toBe(true);
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

describe('resolveShellAccessMode', () => {
  it('keeps a clean signed-out device in the guest shell', () => {
    expect(
      resolveShellAccessMode({
        authConfigured: true,
        authReady: true,
        hasSession: false,
        path: '/now',
        snapshotReady: true,
        workspaceState: makeSnapshot().workspaceState,
      }),
    ).toBe('guest-shell');
  });

  it('routes signed-out member workspaces into recovery', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      authPromptState: 'session-expired',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(
      resolveShellAccessMode({
        authConfigured: true,
        authReady: true,
        hasSession: false,
        path: '/review',
        snapshotReady: true,
        workspaceState: snapshot.workspaceState,
      }),
    ).toBe('member-recovery');
  });

  it('blocks normal routes for wrong-account recovery', () => {
    const snapshot = makeSnapshot();
    snapshot.workspaceState = {
      ...snapshot.workspaceState,
      ownershipState: 'member',
      authPromptState: 'account-mismatch',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(
      resolveShellAccessMode({
        authConfigured: true,
        authReady: true,
        hasSession: false,
        path: '/inbox',
        snapshotReady: true,
        workspaceState: snapshot.workspaceState,
      }),
    ).toBe('wrong-account-recovery');
  });
});

describe('shouldWaitForShellAccess', () => {
  it('waits for auth restoration only for member workspaces', () => {
    const guestSnapshot = makeSnapshot();
    const memberSnapshot = makeSnapshot();
    memberSnapshot.workspaceState = {
      ...memberSnapshot.workspaceState,
      ownershipState: 'member',
      boundUserId: '11111111-1111-4111-8111-111111111111',
    };

    expect(
      shouldWaitForShellAccess({
        authConfigured: true,
        authReady: false,
        snapshotReady: true,
        workspaceState: guestSnapshot.workspaceState,
      }),
    ).toBe(false);
    expect(
      shouldWaitForShellAccess({
        authConfigured: true,
        authReady: false,
        snapshotReady: true,
        workspaceState: memberSnapshot.workspaceState,
      }),
    ).toBe(true);
  });
});
