import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DateKey } from '@/domain/dates';
import {
  DailyRecordSchema,
  SettingsRecordSchema,
  WeeklyRecordSchema,
} from '@/domain/schemas/records';
import { getHoldfastSnapshot } from '@/storage/local/api';
import { HOLDFAST_DB_NAME, db } from '@/storage/local/db';
import {
  LEGACY_PROTOTYPE_STORAGE_KEY,
  getLegacyPrototypeBrowserSummary,
  getLegacyPrototypeUndoAvailability,
  importLegacyPrototypeData,
  undoLastLegacyPrototypeRecovery,
  undoLegacyPrototypeRecoveryData,
} from '@/storage/local/legacy-prototype';

const CURRENT_DATE = '2026-04-19' as DateKey;

async function resetLocalDatabase(): Promise<void> {
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
  await db.open();
}

function currentLikePrototypeWorkspace() {
  return {
    version: 5,
    days: {
      '2026-04-19': {
        date: '2026-04-19',
        started: true,
        closed: false,
        top3: ['task-home'],
        care: {
          water: true,
          food: false,
          vitamins: true,
          hygiene: false,
          movement: true,
          sleep: false,
        },
        launchNote: 'Start with the kitchen.',
        closeWin: '',
        closeCarry: '',
        closeSeed: 'Check pantry first.',
        closeNote: '',
        seededRoutineIds: ['routine-home'],
        updatedAt: '2026-04-19T07:30:00.000Z',
      },
    },
    weeks: {
      '2026-04-13': {
        weekKey: '2026-04-13',
        focus: 'Protect calm mornings.',
        protect: 'Sleep',
        notes: 'Keep errands contained.',
        updatedAt: '2026-04-19T07:30:00.000Z',
      },
    },
    items: [
      {
        id: 'task-home',
        text: 'Buy coffee',
        kind: 'task',
        lane: 'home',
        status: 'later',
        sourceDate: '2026-04-19',
        targetDate: '2026-04-21',
        targetTime: '18:00',
        createdAt: '2026-04-19T07:00:00.000Z',
        updatedAt: '2026-04-19T07:15:00.000Z',
        notes: 'Check pantry before buying more.',
        attachments: [
          {
            id: 'task-home-attachment',
            name: 'coffee.txt',
            type: 'text/plain',
            size: 5,
            dataUrl: 'data:text/plain;base64,aGVsbG8=',
          },
        ],
      },
      {
        id: 'note-inbox',
        text: 'Gift idea',
        kind: 'note',
        lane: 'people',
        status: 'inbox',
        sourceDate: '2026-04-18',
        createdAt: '2026-04-18T18:00:00.000Z',
        updatedAt: '2026-04-18T18:15:00.000Z',
        notes: 'Birthday list for May.',
        imageData: 'data:image/png;base64,aGVsbG8=',
      },
    ],
    settings: {
      focus: 'Stay steady at home.',
      standards: 'Eat first. Reset counters.',
      why: 'Calm is easier to hold when the basics are handled.',
      routines: [
        {
          id: 'routine-home',
          text: 'Check pantry',
          lane: 'home',
          seed: 'later',
          days: [0, 2, 4],
          active: true,
          time: '09:30',
          notes: 'Before any grocery run.',
        },
      ],
    },
  };
}

function legacyV2PrototypeWorkspace() {
  return {
    currentDate: '2026-04-19',
    profile: {
      seasonFocus: 'Steady storefront and home.',
      standards: 'Handle the basics before extras.',
      why: 'Less drift, more trust.',
    },
    recurring: [
      {
        id: 'legacy-routine-health',
        text: 'Take vitamins',
        bucket: 'personalHealth',
        days: [1, 3, 5],
        active: true,
      },
    ],
    days: {
      '2026-04-19': {
        launched: true,
        closed: false,
        care: {
          water: true,
          food: true,
          vitamins: true,
          hygiene: false,
          movement: false,
          sleep: true,
        },
        top3: [
          {
            id: 'legacy-top3',
            text: 'Open the store',
            done: false,
            createdAt: '2026-04-19T08:00:00.000Z',
            updatedAt: '2026-04-19T08:05:00.000Z',
          },
        ],
        followUps: [
          {
            id: 'legacy-follow-up',
            text: 'Call supplier',
            done: false,
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:15:00.000Z',
          },
        ],
        capture: [
          {
            id: 'legacy-capture',
            text: 'Gift idea for June',
            ts: '2026-04-19T11:00:00.000Z',
          },
        ],
        evening: {
          done: 'Handled the key handoff.',
          carry: 'Buy batteries',
          seed: 'Start upstairs first.',
          note: 'Keep tomorrow quieter.',
        },
      },
    },
    weeks: {
      '2026-04-13': {
        focus: 'Keep the week lighter.',
        protect: 'Sleep',
        notes: 'Avoid scattered errands.',
      },
    },
    inbox: [
      {
        id: 'legacy-inbox',
        text: 'Wait for invoice',
        kind: 'task',
        bucket: 'workAdmin',
        status: 'linked',
        sourceDate: '2026-04-19',
        linkedDate: '2026-04-19',
        createdAt: '2026-04-19T12:00:00.000Z',
        updatedAt: '2026-04-19T12:10:00.000Z',
      },
    ],
  };
}

beforeEach(async () => {
  localStorage.clear();
  await resetLocalDatabase();
});

afterEach(async () => {
  localStorage.clear();
  db.close();
  await Dexie.delete(HOLDFAST_DB_NAME);
});

describe('legacy prototype recovery', () => {
  it('summarizes browser prototype data when the storage key is present', () => {
    localStorage.setItem(
      LEGACY_PROTOTYPE_STORAGE_KEY,
      JSON.stringify(currentLikePrototypeWorkspace()),
    );

    expect(getLegacyPrototypeBrowserSummary()).toEqual({
      attachmentCount: 2,
      dayCount: 1,
      itemCount: 2,
      noteCount: 1,
      routineCount: 1,
      taskCount: 1,
      weekCount: 1,
    });
  });

  it('imports current-like prototype data once and leaves repeated recovery idempotent', async () => {
    const payload = currentLikePrototypeWorkspace();

    const first = await importLegacyPrototypeData(payload);
    const firstMutationCount = await db.mutationQueue.count();
    const firstSnapshot = await getHoldfastSnapshot(CURRENT_DATE);

    expect(first).toMatchObject({
      itemsImported: 2,
      itemsSkipped: 0,
      routinesImported: 1,
      routinesSkipped: 0,
      attachmentsImported: 2,
      attachmentsSkipped: 0,
      daysCreated: 1,
      daysMerged: 0,
      weeksCreated: 1,
      weeksMerged: 0,
      settingsUpdated: true,
    });
    expect(firstSnapshot.items).toHaveLength(2);
    expect(firstSnapshot.routines).toHaveLength(1);
    expect(firstSnapshot.currentDay.focusItemIds).toHaveLength(1);
    expect(firstSnapshot.currentDay.readiness).toMatchObject({
      water: true,
      supplements: true,
      movement: true,
    });
    expect(firstSnapshot.weeklyRecord.focus).toBe('Protect calm mornings.');

    const importedTask = firstSnapshot.items.find((item) => item.title === 'Buy coffee');
    const importedNote = firstSnapshot.items.find((item) => item.title === 'Gift idea');

    expect(importedTask).toMatchObject({
      status: 'upcoming',
      scheduledDate: '2026-04-21',
      scheduledTime: '18:00',
      body: 'Check pantry before buying more.',
    });
    expect(importedTask?.attachments).toHaveLength(1);
    expect(importedNote).toMatchObject({
      kind: 'note',
      status: 'inbox',
      body: 'Birthday list for May.',
    });
    expect(importedNote?.attachments).toHaveLength(1);
    expect(firstSnapshot.settings).toMatchObject({
      direction: 'Stay steady at home.',
      standards: 'Eat first. Reset counters.',
      why: 'Calm is easier to hold when the basics are handled.',
    });

    const second = await importLegacyPrototypeData(payload);
    const secondSnapshot = await getHoldfastSnapshot(CURRENT_DATE);

    expect(second).toMatchObject({
      itemsImported: 0,
      itemsSkipped: 2,
      routinesImported: 0,
      routinesSkipped: 1,
      attachmentsImported: 0,
      attachmentsSkipped: 2,
      daysCreated: 0,
      daysMerged: 0,
      weeksCreated: 0,
      weeksMerged: 0,
      settingsUpdated: false,
    });
    expect(secondSnapshot.items).toHaveLength(2);
    expect(secondSnapshot.routines).toHaveLength(1);
    expect(await db.mutationQueue.count()).toBe(firstMutationCount);
  });

  it('adapts older prototype backups into the current workspace model', async () => {
    await importLegacyPrototypeData(legacyV2PrototypeWorkspace());

    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);
    const titles = snapshot.items.map((item) => item.title).sort();

    expect(snapshot.routines).toHaveLength(1);
    expect(snapshot.routines[0]).toMatchObject({
      title: 'Take vitamins',
      lane: 'health',
      destination: 'today',
    });
    expect(snapshot.currentDay.readiness).toMatchObject({
      water: true,
      food: true,
      supplements: true,
      sleepSetup: true,
    });
    expect(snapshot.currentDay.launchNote).toBe('');
    expect(snapshot.currentDay.closeCarry).toBe('Buy batteries');
    expect(snapshot.weeklyRecord.focus).toBe('Keep the week lighter.');
    expect(snapshot.settings).toMatchObject({
      direction: 'Steady storefront and home.',
      standards: 'Handle the basics before extras.',
      why: 'Less drift, more trust.',
    });
    expect(titles).toEqual(
      [
        'Buy batteries',
        'Call supplier',
        'Gift idea for June',
        'Open the store',
        'Wait for invoice',
      ].sort(),
    );
    expect(
      snapshot.items.find((item) => item.title === 'Open the store'),
    ).toMatchObject({ status: 'today' });
    expect(
      snapshot.items.find((item) => item.title === 'Call supplier'),
    ).toMatchObject({ status: 'waiting' });
    expect(
      snapshot.items.find((item) => item.title === 'Gift idea for June'),
    ).toMatchObject({ kind: 'note', status: 'inbox' });
  });

  it('records undo history for new recoveries and restores prior local state', async () => {
    const payload = currentLikePrototypeWorkspace();

    await db.dailyRecords.put(
      DailyRecordSchema.parse({
        date: '2026-04-19',
        schemaVersion: 2,
        startedAt: null,
        closedAt: null,
        readiness: {
          water: false,
          food: true,
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
        createdAt: '2026-04-19T06:00:00.000Z',
        updatedAt: '2026-04-19T06:00:00.000Z',
        syncState: 'pending',
      }),
    );
    await db.weeklyRecords.put(
      WeeklyRecordSchema.parse({
        weekStart: '2026-04-13',
        schemaVersion: 2,
        focus: '',
        protect: 'Keep Sunday open.',
        notes: '',
        createdAt: '2026-04-13T06:00:00.000Z',
        updatedAt: '2026-04-13T06:00:00.000Z',
        syncState: 'pending',
      }),
    );
    await db.settings.put(
      SettingsRecordSchema.parse({
        id: 'settings',
        schemaVersion: 2,
        direction: '',
        standards: 'Keep the basics handled.',
        why: '',
        createdAt: '2026-04-18T06:00:00.000Z',
        updatedAt: '2026-04-18T06:00:00.000Z',
        syncState: 'pending',
      }),
    );

    await importLegacyPrototypeData(payload, { source: 'file' });

    expect(await getLegacyPrototypeUndoAvailability()).toMatchObject({
      mode: 'recorded',
      source: 'file',
    });

    const undo = await undoLastLegacyPrototypeRecovery();
    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);

    expect(undo).toMatchObject({
      itemsDeleted: 2,
      routinesDeleted: 1,
      attachmentsDeleted: 2,
      daysRestored: 1,
      weeksRestored: 1,
      settingsRestored: true,
      partial: false,
    });
    expect(snapshot.items).toEqual([]);
    expect(snapshot.routines).toEqual([]);
    expect(snapshot.currentDay).toMatchObject({
      focusItemIds: [],
      readiness: {
        water: false,
        food: true,
        supplements: false,
        hygiene: false,
        movement: false,
        sleepSetup: false,
      },
      launchNote: '',
      closeSeed: '',
    });
    expect(snapshot.weeklyRecord).toMatchObject({
      focus: '',
      protect: 'Keep Sunday open.',
      notes: '',
    });
    expect(snapshot.settings).toMatchObject({
      direction: '',
      standards: 'Keep the basics handled.',
      why: '',
    });
    expect(await getLegacyPrototypeUndoAvailability()).toMatchObject({
      mode: 'none',
    });
  });

  it('uses the backup payload to reverse older imports that predate undo sessions', async () => {
    const payload = currentLikePrototypeWorkspace();

    await importLegacyPrototypeData(payload, { source: 'file' });
    await db.prototypeRecoverySessions.clear();

    expect(await getLegacyPrototypeUndoAvailability()).toMatchObject({
      mode: 'retroactive',
    });

    const undo = await undoLegacyPrototypeRecoveryData(payload);
    const snapshot = await getHoldfastSnapshot(CURRENT_DATE);

    expect(undo).toMatchObject({
      itemsDeleted: 2,
      routinesDeleted: 1,
      attachmentsDeleted: 2,
      partial: true,
    });
    expect(snapshot.items).toEqual([]);
    expect(snapshot.routines).toEqual([]);
    expect(snapshot.currentDay.focusItemIds).toEqual([]);
    expect(snapshot.currentDay.launchNote).toBe('');
    expect(snapshot.weeklyRecord.focus).toBe('');
    expect(snapshot.settings).toMatchObject({
      direction: '',
      standards: '',
      why: '',
    });
    expect(await getLegacyPrototypeUndoAvailability()).toMatchObject({
      mode: 'none',
    });
  });
});
