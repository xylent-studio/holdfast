import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import {
  fromRemoteDailyRecordRow,
  fromRemoteListRow,
  toRemoteDailyRecordRow,
  toRemoteListRow,
} from '@/storage/sync/supabase/schema';

describe('supabase schema mapping', () => {
  it('normalizes older remote rows to the current local schema shape', () => {
    const list = fromRemoteListRow({
      id: '11111111-1111-4111-8111-111111111111',
      user_id: '22222222-2222-4222-8222-222222222222',
      schema_version: 3,
      title: 'Groceries',
      kind: 'replenishment',
      lane: 'home',
      pinned: false,
      source_item_id: null,
      archived_at: null,
      created_at: '2026-04-23T12:00:00.000Z',
      updated_at: '2026-04-23T12:30:00.000Z',
      deleted_at: null,
      server_updated_at: '2026-04-23T12:31:00.000Z',
    });
    const dailyRecord = fromRemoteDailyRecordRow({
      user_id: '22222222-2222-4222-8222-222222222222',
      date: '2026-04-23',
      schema_version: 3,
      started_at: null,
      closed_at: null,
      readiness: {},
      focus_item_ids: [],
      launch_note: '',
      close_win: '',
      close_carry: '',
      close_seed: '',
      close_note: '',
      seeded_routine_ids: [],
      created_at: '2026-04-23T07:00:00.000Z',
      updated_at: '2026-04-23T07:30:00.000Z',
      server_updated_at: '2026-04-23T07:31:00.000Z',
    });

    expect(list).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      scheduledDate: null,
      scheduledTime: null,
      completedAt: null,
    });
    expect(dailyRecord).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      focusListIds: [],
    });
  });

  it('round-trips list scheduling and completion fields', () => {
    const list = {
      id: '11111111-1111-4111-8111-111111111111',
      schemaVersion: SCHEMA_VERSION,
      title: 'Groceries',
      kind: 'replenishment' as const,
      lane: 'home' as const,
      pinned: true,
      sourceItemId: null,
      scheduledDate: '2026-04-24',
      scheduledTime: '09:15',
      completedAt: '2026-04-24T15:00:00.000Z',
      archivedAt: null,
      createdAt: '2026-04-23T12:00:00.000Z',
      updatedAt: '2026-04-23T12:30:00.000Z',
      deletedAt: null,
      syncState: 'pending' as const,
      remoteRevision: null,
    };

    const remote = toRemoteListRow(
      '22222222-2222-4222-8222-222222222222',
      list,
    );
    const roundTripped = fromRemoteListRow({
      ...remote,
      server_updated_at: '2026-04-23T12:31:00.000Z',
    });

    expect(remote).toMatchObject({
      scheduled_date: '2026-04-24',
      scheduled_time: '09:15',
      completed_at: '2026-04-24T15:00:00.000Z',
    });
    expect(roundTripped).toMatchObject({
      scheduledDate: '2026-04-24',
      scheduledTime: '09:15',
      completedAt: '2026-04-24T15:00:00.000Z',
      remoteRevision: '2026-04-23T12:31:00.000Z',
    });
  });

  it('round-trips day-level list focus ids', () => {
    const dailyRecord = {
      date: '2026-04-23',
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
      focusItemIds: ['33333333-3333-4333-8333-333333333333'],
      focusListIds: ['44444444-4444-4444-8444-444444444444'],
      launchNote: '',
      closeWin: '',
      closeCarry: '',
      closeSeed: '',
      closeNote: '',
      seededRoutineIds: [],
      createdAt: '2026-04-23T07:00:00.000Z',
      updatedAt: '2026-04-23T07:30:00.000Z',
      syncState: 'pending' as const,
      remoteRevision: null,
    };

    const remote = toRemoteDailyRecordRow(
      '22222222-2222-4222-8222-222222222222',
      dailyRecord,
    );
    const roundTripped = fromRemoteDailyRecordRow({
      ...remote,
      server_updated_at: '2026-04-23T07:31:00.000Z',
    });

    expect(remote.focus_list_ids).toEqual([
      '44444444-4444-4444-8444-444444444444',
    ]);
    expect(roundTripped.focusListIds).toEqual([
      '44444444-4444-4444-8444-444444444444',
    ]);
  });
});
