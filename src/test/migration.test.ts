import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import {
  AttachmentRecordSchema,
  DailyRecordSchema,
  ItemRecordSchema,
  MutationRecordSchema,
  RoutineRecordSchema,
  SettingsRecordSchema,
  WorkspaceStateRecordSchema,
  WeeklyRecordSchema,
} from '@/domain/schemas/records';
import { normalizeWorkspaceStateRecord } from '@/storage/local/workspace-state';
import { normalizeSyncStateRecord } from '@/storage/sync/state';
import { HoldfastDatabase } from '@/storage/local/db';

const V1_STORES = {
  items: 'id, status, lane, scheduledDate, updatedAt, routineId, deletedAt',
  dailyRecords: 'date, updatedAt',
  weeklyRecords: 'weekStart, updatedAt',
  routines: 'id, active, updatedAt, deletedAt',
  settings: 'id, updatedAt',
  attachments: 'id, itemId, kind, updatedAt, deletedAt',
  attachmentBlobs: 'id, createdAt',
  mutationQueue: 'id, entity, entityId, status, createdAt',
  syncState: 'id, updatedAt',
} as const;

const dbNames: string[] = [];

afterEach(async () => {
  await Promise.all(
    dbNames.splice(0).map(async (name) => {
      const db = new Dexie(name);
      db.close();
      await Dexie.delete(name);
    }),
  );
});

describe('HoldfastDatabase migration', () => {
  it('upgrades v1 local data to the current schema without dropping records', async () => {
    const name = `holdfast-migration-${crypto.randomUUID()}`;
    dbNames.push(name);

    const v1 = new Dexie(name);
    v1.version(1).stores(V1_STORES);
    await v1.open();

    const itemId = crypto.randomUUID();
    const noteId = crypto.randomUUID();
    const routineId = crypto.randomUUID();
    const attachmentId = crypto.randomUUID();
    const blobId = crypto.randomUUID();
    const mutationId = crypto.randomUUID();

    await v1.table('items').bulkAdd([
      {
        id: itemId,
        schemaVersion: 1,
        title: 'Existing task',
        kind: 'task',
        lane: 'home',
        status: 'today',
        body: 'Buy coffee filters',
        sourceDate: '2026-04-18',
        scheduledDate: '2026-04-18',
        scheduledTime: '09:00',
        routineId: null,
        completedAt: null,
        archivedAt: null,
        createdAt: '2026-04-18T08:00:00.000Z',
        updatedAt: '2026-04-18T08:00:00.000Z',
        deletedAt: null,
        syncState: 'pending',
      },
      {
        id: noteId,
        schemaVersion: 1,
        title: 'Existing note',
        kind: 'note',
        lane: 'work',
        status: 'inbox',
        body: 'Remember vendor quote',
        sourceDate: '2026-04-18',
        scheduledDate: null,
        scheduledTime: null,
        routineId: null,
        completedAt: null,
        archivedAt: null,
        createdAt: '2026-04-18T08:05:00.000Z',
        updatedAt: '2026-04-18T08:05:00.000Z',
        deletedAt: null,
        syncState: 'pending',
      },
    ]);
    await v1.table('dailyRecords').put({
      date: '2026-04-18',
      schemaVersion: 1,
      startedAt: '2026-04-18T07:00:00.000Z',
      closedAt: null,
      readiness: {
        water: true,
        food: false,
        supplements: false,
        hygiene: true,
        movement: false,
        sleepSetup: false,
      },
      focusItemIds: [itemId],
      launchNote: 'Start strong',
      closeWin: '',
      closeCarry: '',
      closeSeed: '',
      closeNote: '',
      seededRoutineIds: [],
      createdAt: '2026-04-18T07:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
      syncState: 'pending',
    });
    await v1.table('weeklyRecords').put({
      weekStart: '2026-04-13',
      schemaVersion: 1,
      focus: 'Keep it calm',
      protect: 'Sleep',
      notes: '',
      createdAt: '2026-04-13T07:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
      syncState: 'pending',
    });
    await v1.table('routines').put({
      id: routineId,
      schemaVersion: 1,
      title: 'Open store',
      lane: 'work',
      destination: 'today',
      weekdays: [1, 2, 3, 4, 5],
      scheduledTime: '08:00',
      notes: 'Lights, tills, doors',
      active: true,
      createdAt: '2026-04-18T07:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
      deletedAt: null,
      syncState: 'pending',
    });
    await v1.table('settings').put({
      id: 'settings',
      schemaVersion: 1,
      direction: 'Protect the spine',
      standards: 'Keep it direct',
      why: 'Trusted daily system',
      createdAt: '2026-04-18T07:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
      syncState: 'pending',
    });
    await v1.table('attachmentBlobs').put({
      id: blobId,
      schemaVersion: 1,
      blob: new Blob(['receipt'], { type: 'text/plain' }),
      createdAt: '2026-04-18T08:00:00.000Z',
    });
    await v1.table('attachments').put({
      id: attachmentId,
      schemaVersion: 1,
      itemId,
      blobId,
      kind: 'file',
      name: 'receipt.txt',
      mimeType: 'text/plain',
      size: 7,
      createdAt: '2026-04-18T08:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
      deletedAt: null,
      syncState: 'pending',
    });
    await v1.table('mutationQueue').put({
      id: mutationId,
      schemaVersion: 1,
      entity: 'item',
      entityId: itemId,
      type: 'item.created',
      payload: { itemId },
      createdAt: '2026-04-18T08:00:00.000Z',
      status: 'pending',
      attempts: 0,
      lastError: null,
    });
    await v1.table('syncState').put({
      id: 'sync',
      schemaVersion: 1,
      provider: 'supabase',
      mode: 'ready',
      lastSyncedAt: null,
      authState: 'signed-out',
      createdAt: '2026-04-18T08:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
    });

    v1.close();

    const upgraded = new HoldfastDatabase(name);
    await upgraded.open();

    const [items, dailyRecords, weeklyRecords, routines, settings] =
      await Promise.all([
        upgraded.items.toArray(),
        upgraded.dailyRecords.toArray(),
        upgraded.weeklyRecords.toArray(),
        upgraded.routines.toArray(),
        upgraded.settings.toArray(),
      ]);

    expect(items).toHaveLength(2);
    expect(dailyRecords).toHaveLength(1);
    expect(weeklyRecords).toHaveLength(1);
    expect(routines).toHaveLength(1);
    expect(settings).toHaveLength(1);
    expect(await upgraded.attachments.count()).toBe(1);
    expect(await upgraded.attachmentBlobs.count()).toBe(1);
    expect(await upgraded.mutationQueue.count()).toBe(1);
    expect(await upgraded.syncState.count()).toBe(1);
    expect(await upgraded.workspaceState.count()).toBe(0);

    const migratedTask = ItemRecordSchema.parse(
      items.find((item) => item.id === itemId),
    );
    const migratedNote = ItemRecordSchema.parse(
      items.find((item) => item.id === noteId),
    );

    expect(migratedTask.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migratedTask.sourceText).toBeNull();
    expect(migratedTask.sourceItemId).toBeNull();
    expect(migratedTask.captureMode).toBeNull();
    expect(migratedNote.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migratedNote.sourceText).toBeNull();
    expect(migratedNote.sourceItemId).toBeNull();
    expect(migratedNote.captureMode).toBeNull();

    expect(DailyRecordSchema.parse(dailyRecords[0]).schemaVersion).toBe(
      SCHEMA_VERSION,
    );
    expect(WeeklyRecordSchema.parse(weeklyRecords[0]).schemaVersion).toBe(
      SCHEMA_VERSION,
    );
    expect(RoutineRecordSchema.parse(routines[0]).schemaVersion).toBe(
      SCHEMA_VERSION,
    );
    expect(SettingsRecordSchema.parse(settings[0]).schemaVersion).toBe(
      SCHEMA_VERSION,
    );
    expect(
      AttachmentRecordSchema.parse(
        await upgraded.attachments.get(attachmentId),
      ),
    ).toMatchObject({
      id: attachmentId,
      schemaVersion: SCHEMA_VERSION,
      itemId,
    });
    expect(
      MutationRecordSchema.parse(await upgraded.mutationQueue.get(mutationId)),
    ).toMatchObject({
      id: mutationId,
      schemaVersion: SCHEMA_VERSION,
      entity: 'item',
    });
    expect(
      normalizeSyncStateRecord(await upgraded.syncState.get('sync')),
    ).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      mode: 'ready',
    });
    expect(
      normalizeWorkspaceStateRecord(
        WorkspaceStateRecordSchema.parse({
          id: 'workspace',
          schemaVersion: SCHEMA_VERSION,
          ownershipState: 'device-guest',
          boundUserId: null,
          authPromptState: 'none',
          attachState: 'attached',
          createdAt: '2026-04-18T08:00:00.000Z',
          updatedAt: '2026-04-18T08:00:00.000Z',
        }),
      ),
    ).toMatchObject({
      ownershipState: 'device-guest',
      boundUserId: null,
    });

    upgraded.close();
  });
});
