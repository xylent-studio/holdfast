import { describe, expect, it } from 'vitest';

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
