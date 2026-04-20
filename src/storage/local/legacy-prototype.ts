import {
  SCHEMA_VERSION,
  SETTINGS_ROW_ID,
  SYNC_STATE_ROW_ID,
} from '@/domain/constants';
import { nowIso } from '@/domain/dates';
import {
  AttachmentBlobRecordSchema,
  AttachmentRecordSchema,
  DailyRecordSchema,
  ItemRecordSchema,
  MutationRecordSchema,
  RoutineRecordSchema,
  SettingsRecordSchema,
  type AttachmentKind,
  type DailyRecord,
  type ItemRecord,
  type Lane,
  type MutationRecord,
  type RoutineRecord,
  type SettingsRecord,
  type WeeklyRecord,
  WeeklyRecordSchema,
} from '@/domain/schemas/records';
import { db } from '@/storage/local/db';
import { getSupabaseSyncStatus } from '@/storage/sync/supabase/config';
import { createDefaultSyncState } from '@/storage/sync/state';

export const LEGACY_PROTOTYPE_STORAGE_KEY = 'justin-os-standalone-v1';

type LegacyStatus =
  | 'inbox'
  | 'today'
  | 'later'
  | 'waiting'
  | 'done'
  | 'archived';

type LegacyItemKind = 'task' | 'note';

interface LegacyPrototypeAttachment {
  legacyKey: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface LegacyPrototypeRoutine {
  legacyKey: string;
  text: string;
  lane: Lane;
  destination: RoutineRecord['destination'];
  weekdays: number[];
  scheduledTime: string | null;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LegacyPrototypeItem {
  legacyKey: string;
  text: string;
  kind: LegacyItemKind;
  lane: Lane;
  status: LegacyStatus;
  sourceDate: string;
  targetDate: string | null;
  targetTime: string | null;
  routineLegacyKey: string | null;
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
  archivedAt: string | null;
  notes: string;
  attachments: LegacyPrototypeAttachment[];
}

interface LegacyPrototypeDay {
  date: string;
  startedAt: string | null;
  closedAt: string | null;
  readiness: DailyRecord['readiness'];
  focusLegacyKeys: string[];
  launchNote: string;
  closeWin: string;
  closeCarry: string;
  closeSeed: string;
  closeNote: string;
  seededRoutineLegacyKeys: string[];
  createdAt: string;
  updatedAt: string;
}

interface LegacyPrototypeWeek {
  weekStart: string;
  focus: string;
  protect: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface LegacyPrototypeSettings {
  direction: string;
  standards: string;
  why: string;
  routines: LegacyPrototypeRoutine[];
}

interface LegacyPrototypeWorkspace {
  days: Record<string, LegacyPrototypeDay>;
  weeks: Record<string, LegacyPrototypeWeek>;
  items: LegacyPrototypeItem[];
  settings: LegacyPrototypeSettings;
}

export interface LegacyPrototypeSummary {
  attachmentCount: number;
  dayCount: number;
  itemCount: number;
  noteCount: number;
  routineCount: number;
  taskCount: number;
  weekCount: number;
}

export interface LegacyPrototypeImportResult {
  attachmentsImported: number;
  attachmentsSkipped: number;
  daysCreated: number;
  daysMerged: number;
  itemsImported: number;
  itemsSkipped: number;
  routinesImported: number;
  routinesSkipped: number;
  settingsUpdated: boolean;
  summary: LegacyPrototypeSummary;
  weeksCreated: number;
  weeksMerged: number;
}

function isLane(value: unknown): value is Lane {
  return (
    typeof value === 'string' &&
    (['work', 'health', 'home', 'people', 'build', 'admin'] as Lane[]).includes(
      value as Lane,
    )
  );
}

function toLane(value: unknown, fallback: Lane = 'admin'): Lane {
  return isLane(value) ? value : fallback;
}

function toLegacyStatus(value: unknown): LegacyStatus {
  switch (value) {
    case 'today':
    case 'later':
    case 'waiting':
    case 'done':
    case 'archived':
      return value;
    default:
      return 'inbox';
  }
}

function toCurrentStatus(
  value: LegacyStatus,
): ItemRecord['status'] {
  switch (value) {
    case 'later':
      return 'upcoming';
    default:
      return value;
  }
}

function toIsoDate(value: unknown, fallback: string): string {
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  return fallback;
}

function toIsoTimestamp(value: unknown, fallback = nowIso()): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }

  return fallback;
}

function optionalTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function booleanTimestamp(
  value: unknown,
  fallback: string,
): string | null {
  return value ? fallback : null;
}

function normalizeAttachment(
  attachment: unknown,
  fallbackKey: string,
): LegacyPrototypeAttachment | null {
  if (!attachment || typeof attachment !== 'object') {
    return null;
  }

  const record = attachment as Record<string, unknown>;
  const dataUrl =
    typeof record.dataUrl === 'string' ? record.dataUrl.trim() : '';
  if (!dataUrl.startsWith('data:')) {
    return null;
  }

  return {
    legacyKey:
      typeof record.id === 'string' && record.id.trim()
        ? record.id
        : fallbackKey,
    name:
      typeof record.name === 'string' && record.name.trim()
        ? record.name
        : 'attachment',
    type:
      typeof record.type === 'string' && record.type.trim()
        ? record.type
        : 'application/octet-stream',
    size:
      typeof record.size === 'number' && Number.isFinite(record.size)
        ? Math.max(0, record.size)
        : 0,
    dataUrl,
  };
}

function attachmentKind(type: string): AttachmentKind {
  if (type.startsWith('image/')) {
    return 'image';
  }
  if (type.startsWith('audio/')) {
    return 'audio';
  }
  return 'file';
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, payload = ''] = dataUrl.split(',');
  const mimeMatch = meta.match(/^data:([^;]+);/i);
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream';
  const decoded = atob(payload);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function emptyLegacyWorkspace(): LegacyPrototypeWorkspace {
  return {
    days: {},
    weeks: {},
    items: [],
    settings: {
      direction: '',
      standards: '',
      why: '',
      routines: [],
    },
  };
}

function normalizeCurrentLikeWorkspace(raw: unknown): LegacyPrototypeWorkspace {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Prototype data was not readable.');
  }

  const source = raw as Record<string, unknown>;
  const workspace = emptyLegacyWorkspace();
  const days = source.days as Record<string, unknown> | undefined;
  const weeks = source.weeks as Record<string, unknown> | undefined;
  const items = Array.isArray(source.items) ? source.items : [];
  const settings =
    source.settings && typeof source.settings === 'object'
      ? (source.settings as Record<string, unknown>)
      : {};

  for (const [date, rawDay] of Object.entries(days ?? {})) {
    const entry =
      rawDay && typeof rawDay === 'object'
        ? (rawDay as Record<string, unknown>)
        : {};
    const updatedAt = toIsoTimestamp(entry.updatedAt, nowIso());

    workspace.days[date] = {
      date: toIsoDate(entry.date, date),
      startedAt: booleanTimestamp(entry.started, updatedAt),
      closedAt: booleanTimestamp(entry.closed, updatedAt),
      readiness: {
        water: Boolean((entry.care as Record<string, unknown> | undefined)?.water),
        food: Boolean((entry.care as Record<string, unknown> | undefined)?.food),
        supplements: Boolean(
          (entry.care as Record<string, unknown> | undefined)?.vitamins,
        ),
        hygiene: Boolean(
          (entry.care as Record<string, unknown> | undefined)?.hygiene,
        ),
        movement: Boolean(
          (entry.care as Record<string, unknown> | undefined)?.movement,
        ),
        sleepSetup: Boolean(
          (entry.care as Record<string, unknown> | undefined)?.sleep,
        ),
      },
      focusLegacyKeys: Array.isArray(entry.top3)
        ? entry.top3.filter((value): value is string => typeof value === 'string')
        : [],
      launchNote:
        typeof entry.launchNote === 'string' ? entry.launchNote : '',
      closeWin:
        typeof entry.closeWin === 'string' ? entry.closeWin : '',
      closeCarry:
        typeof entry.closeCarry === 'string' ? entry.closeCarry : '',
      closeSeed:
        typeof entry.closeSeed === 'string' ? entry.closeSeed : '',
      closeNote:
        typeof entry.closeNote === 'string' ? entry.closeNote : '',
      seededRoutineLegacyKeys: Array.isArray(entry.seededRoutineIds)
        ? entry.seededRoutineIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
      createdAt: updatedAt,
      updatedAt,
    };
  }

  for (const [weekKey, rawWeek] of Object.entries(weeks ?? {})) {
    const entry =
      rawWeek && typeof rawWeek === 'object'
        ? (rawWeek as Record<string, unknown>)
        : {};
    const updatedAt = toIsoTimestamp(entry.updatedAt, nowIso());

    workspace.weeks[weekKey] = {
      weekStart: toIsoDate(entry.weekKey, weekKey),
      focus: typeof entry.focus === 'string' ? entry.focus : '',
      protect: typeof entry.protect === 'string' ? entry.protect : '',
      notes: typeof entry.notes === 'string' ? entry.notes : '',
      createdAt: updatedAt,
      updatedAt,
    };
  }

  workspace.items = items.flatMap((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object') {
      return [];
    }

    const entry = rawItem as Record<string, unknown>;
    const legacyKey =
      typeof entry.id === 'string' && entry.id.trim()
        ? entry.id
        : `item-${index}-${String(entry.text ?? '').trim()}`;
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!text) {
      return [];
    }

    const createdAt = toIsoTimestamp(entry.createdAt, nowIso());
    const updatedAt = toIsoTimestamp(entry.updatedAt, createdAt);
    const attachments = (
      Array.isArray(entry.attachments) ? entry.attachments : []
    )
      .map((attachment, attachmentIndex) =>
        normalizeAttachment(
          attachment,
          `${legacyKey}:attachment:${attachmentIndex}`,
        ),
      )
      .filter((attachment): attachment is LegacyPrototypeAttachment =>
        Boolean(attachment),
      );

    const imageData =
      typeof entry.imageData === 'string' ? entry.imageData.trim() : '';
    if (
      imageData.startsWith('data:') &&
      !attachments.some((attachment) => attachment.dataUrl === imageData)
    ) {
      attachments.unshift({
        legacyKey: `${legacyKey}:imageData`,
        name: 'photo.jpg',
        type: 'image/jpeg',
        size: 0,
        dataUrl: imageData,
      });
    }

    return [
      {
        legacyKey,
        text,
        kind: entry.kind === 'note' ? 'note' : 'task',
        lane: toLane(entry.lane),
        status: toLegacyStatus(entry.status),
        sourceDate: toIsoDate(entry.sourceDate, createdAt.slice(0, 10)),
        targetDate:
          typeof entry.targetDate === 'string' && entry.targetDate.trim()
            ? entry.targetDate
            : null,
        targetTime:
          typeof entry.targetTime === 'string' && entry.targetTime.trim()
            ? entry.targetTime
            : null,
        routineLegacyKey:
          typeof entry.routineId === 'string' && entry.routineId.trim()
            ? entry.routineId
            : null,
        createdAt,
        updatedAt,
        doneAt: optionalTimestamp(entry.doneAt),
        archivedAt: optionalTimestamp(entry.archivedAt),
        notes: typeof entry.notes === 'string' ? entry.notes : '',
        attachments,
      } satisfies LegacyPrototypeItem,
    ];
  });

  workspace.settings = {
    direction:
      typeof settings.focus === 'string' ? settings.focus : '',
    standards:
      typeof settings.standards === 'string' ? settings.standards : '',
    why: typeof settings.why === 'string' ? settings.why : '',
    routines: (Array.isArray(settings.routines) ? settings.routines : [])
      .flatMap((rawRoutine, index) => {
        if (!rawRoutine || typeof rawRoutine !== 'object') {
          return [];
        }

        const entry = rawRoutine as Record<string, unknown>;
        const text =
          typeof entry.text === 'string' ? entry.text.trim() : '';
        if (!text) {
          return [];
        }

        const legacyKey =
          typeof entry.id === 'string' && entry.id.trim()
            ? entry.id
            : `routine-${index}-${text}`;
        const updatedAt = nowIso();

        return [
          {
            legacyKey,
            text,
            lane: toLane(entry.lane),
            destination: entry.seed === 'later' ? 'upcoming' : 'today',
            weekdays: Array.isArray(entry.days)
              ? entry.days
                  .filter((value): value is number => typeof value === 'number')
                  .filter((value) => value >= 0 && value <= 6)
              : [0, 1, 2, 3, 4, 5, 6],
            scheduledTime:
              typeof entry.time === 'string' && entry.time.trim()
                ? entry.time
                : null,
            notes: typeof entry.notes === 'string' ? entry.notes : '',
            active: entry.active !== false,
            createdAt: updatedAt,
            updatedAt,
          } satisfies LegacyPrototypeRoutine,
        ];
      }),
  };

  return workspace;
}

function migrateLegacyV2Workspace(raw: unknown): LegacyPrototypeWorkspace {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Prototype data was not readable.');
  }

  const source = raw as Record<string, unknown>;
  const workspace = emptyLegacyWorkspace();
  const laneMap: Record<string, Lane> = {
    buildFuture: 'build',
    followUps: 'admin',
    homeErrands: 'home',
    parkingLot: 'admin',
    personalHealth: 'health',
    relationships: 'people',
    workAdmin: 'work',
  };

  workspace.settings.direction =
    typeof (source.profile as Record<string, unknown> | undefined)
      ?.seasonFocus === 'string'
      ? ((source.profile as Record<string, unknown>).seasonFocus as string)
      : '';
  workspace.settings.standards =
    typeof (source.profile as Record<string, unknown> | undefined)
      ?.standards === 'string'
      ? ((source.profile as Record<string, unknown>).standards as string)
      : '';
  workspace.settings.why =
    typeof (source.profile as Record<string, unknown> | undefined)?.why ===
    'string'
      ? ((source.profile as Record<string, unknown>).why as string)
      : '';

  workspace.settings.routines = (
    Array.isArray(source.recurring) ? source.recurring : []
  ).flatMap((rawRoutine, index) => {
    if (!rawRoutine || typeof rawRoutine !== 'object') {
      return [];
    }

    const entry = rawRoutine as Record<string, unknown>;
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!text) {
      return [];
    }

    const createdAt = nowIso();

    return [
      {
        legacyKey:
          typeof entry.id === 'string' && entry.id.trim()
            ? entry.id
            : `legacy-routine-${index}-${text}`,
        text,
        lane: laneMap[String(entry.bucket ?? '')] ?? 'admin',
        destination:
          entry.bucket === 'followUps' || entry.bucket === 'parkingLot'
            ? 'upcoming'
            : 'today',
        weekdays: Array.isArray(entry.days)
          ? entry.days
              .filter((value): value is number => typeof value === 'number')
              .filter((value) => value >= 0 && value <= 6)
          : [0, 1, 2, 3, 4, 5, 6],
        scheduledTime: null,
        notes: '',
        active: entry.active !== false,
        createdAt,
        updatedAt: createdAt,
      } satisfies LegacyPrototypeRoutine,
    ];
  });

  const addLegacyItems = (
    items: LegacyPrototypeItem[],
    values: unknown,
    lane: Lane,
    statusIfOpen: LegacyStatus,
    sourceDate: string,
  ): LegacyPrototypeItem[] => {
    const list = Array.isArray(values) ? values : [];

    return [
      ...items,
      ...list.flatMap((rawItem, index) => {
        if (!rawItem || typeof rawItem !== 'object') {
          return [];
        }

        const entry = rawItem as Record<string, unknown>;
        const text = typeof entry.text === 'string' ? entry.text.trim() : '';
        if (!text) {
          return [];
        }

        const createdAt = toIsoTimestamp(entry.createdAt, nowIso());
        const updatedAt = toIsoTimestamp(entry.updatedAt, createdAt);

        return [
          {
            legacyKey:
              typeof entry.id === 'string' && entry.id.trim()
                ? entry.id
                : `${sourceDate}:${lane}:${statusIfOpen}:${index}:${text}`,
            text,
            kind: 'task',
            lane,
            status: entry.done ? 'done' : statusIfOpen,
            sourceDate,
            targetDate: statusIfOpen === 'today' ? sourceDate : null,
            targetTime: null,
            routineLegacyKey: null,
            createdAt,
            updatedAt,
            doneAt: entry.done ? updatedAt : null,
            archivedAt: null,
            notes: '',
            attachments: [],
          } satisfies LegacyPrototypeItem,
        ];
      }),
    ];
  };

  for (const [date, rawDay] of Object.entries(
    (source.days as Record<string, unknown> | undefined) ?? {},
  )) {
    const entry =
      rawDay && typeof rawDay === 'object'
        ? (rawDay as Record<string, unknown>)
        : {};
    const updatedAt = nowIso();
    const focusLegacyKeys = (
      Array.isArray(entry.top3) ? entry.top3 : Array.isArray(entry.critical3) ? entry.critical3 : []
    )
      .map((rawItem) =>
        rawItem && typeof rawItem === 'object'
          ? (rawItem as Record<string, unknown>)
          : null,
      )
      .filter((value): value is Record<string, unknown> => Boolean(value))
      .map((item, index) =>
        typeof item.id === 'string' && item.id.trim()
          ? item.id
          : `${date}:admin:${date === toIsoDate(source.currentDate, date) ? 'today' : 'later'}:${index}:${String(item.text ?? '').trim()}`,
      );

    workspace.days[date] = {
      date,
      startedAt: booleanTimestamp(entry.launched, updatedAt),
      closedAt: booleanTimestamp(entry.closed, updatedAt),
      readiness: {
        water: Boolean((entry.care as Record<string, unknown> | undefined)?.water),
        food: Boolean((entry.care as Record<string, unknown> | undefined)?.food),
        supplements: Boolean(
          (entry.care as Record<string, unknown> | undefined)?.vitamins,
        ),
        hygiene: Boolean(
          (entry.care as Record<string, unknown> | undefined)?.hygiene,
        ),
        movement: Boolean(
          (entry.care as Record<string, unknown> | undefined)?.movement,
        ),
        sleepSetup: Boolean(
          (entry.care as Record<string, unknown> | undefined)?.sleep,
        ),
      },
      focusLegacyKeys,
      launchNote: typeof entry.launch === 'string' ? entry.launch : '',
      closeWin:
        typeof (entry.evening as Record<string, unknown> | undefined)?.done ===
        'string'
          ? ((entry.evening as Record<string, unknown>).done as string)
          : '',
      closeCarry:
        typeof (entry.evening as Record<string, unknown> | undefined)
          ?.carry === 'string'
          ? ((entry.evening as Record<string, unknown>).carry as string)
          : '',
      closeSeed:
        typeof (entry.evening as Record<string, unknown> | undefined)?.seed ===
        'string'
          ? ((entry.evening as Record<string, unknown>).seed as string)
          : '',
      closeNote:
        typeof (entry.evening as Record<string, unknown> | undefined)?.note ===
        'string'
          ? ((entry.evening as Record<string, unknown>).note as string)
          : '',
      seededRoutineLegacyKeys: [],
      createdAt: updatedAt,
      updatedAt,
    };

    workspace.items = addLegacyItems(
      workspace.items,
      entry.top3 ?? entry.critical3,
      'admin',
      date === toIsoDate(source.currentDate, date) ? 'today' : 'later',
      date,
    );

    for (const [bucket, lane] of Object.entries(laneMap)) {
      workspace.items = addLegacyItems(
        workspace.items,
        entry[bucket],
        lane,
        bucket === 'followUps'
          ? 'waiting'
          : bucket === 'parkingLot'
            ? 'later'
            : date === toIsoDate(source.currentDate, date)
              ? 'today'
              : 'later',
        date,
      );
    }

    if (Array.isArray(entry.capture)) {
      workspace.items.push(
        ...entry.capture.flatMap((rawNote, index) => {
          if (!rawNote || typeof rawNote !== 'object') {
            return [];
          }

          const note = rawNote as Record<string, unknown>;
          const text = typeof note.text === 'string' ? note.text.trim() : '';
          if (!text) {
            return [];
          }

          const createdAt = toIsoTimestamp(note.ts, nowIso());

          return [
            {
              legacyKey:
                typeof note.id === 'string' && note.id.trim()
                  ? note.id
                  : `${date}:capture:${index}:${text}`,
              text,
              kind: 'note',
              lane: 'admin',
              status: 'inbox',
              sourceDate: date,
              targetDate: null,
              targetTime: null,
              routineLegacyKey: null,
              createdAt,
              updatedAt: createdAt,
              doneAt: null,
              archivedAt: null,
              notes: '',
              attachments: [],
            } satisfies LegacyPrototypeItem,
          ];
        }),
      );
    }

    if (workspace.days[date].closeCarry.trim()) {
      workspace.items.push({
        legacyKey: `${date}:closeCarry`,
        text: workspace.days[date].closeCarry,
        kind: 'note',
        lane: 'admin',
        status: 'inbox',
        sourceDate: date,
        targetDate: null,
        targetTime: null,
        routineLegacyKey: null,
        createdAt: updatedAt,
        updatedAt,
        doneAt: null,
        archivedAt: null,
        notes: 'carry',
        attachments: [],
      });
    }
  }

  for (const [weekKey, rawWeek] of Object.entries(
    (source.weeks as Record<string, unknown> | undefined) ?? {},
  )) {
    const entry =
      rawWeek && typeof rawWeek === 'object'
        ? (rawWeek as Record<string, unknown>)
        : {};
    const updatedAt = nowIso();

    workspace.weeks[weekKey] = {
      weekStart: weekKey,
      focus: typeof entry.focus === 'string' ? entry.focus : '',
      protect: typeof entry.protect === 'string' ? entry.protect : '',
      notes: typeof entry.notes === 'string' ? entry.notes : '',
      createdAt: updatedAt,
      updatedAt,
    };
  }

  workspace.items.push(
    ...((Array.isArray(source.inbox) ? source.inbox : []) as unknown[]).flatMap(
      (rawItem, index) => {
        if (!rawItem || typeof rawItem !== 'object') {
          return [];
        }

        const entry = rawItem as Record<string, unknown>;
        const text = typeof entry.text === 'string' ? entry.text.trim() : '';
        if (!text) {
          return [];
        }

        const updatedAt = toIsoTimestamp(entry.updatedAt, nowIso());

        return [
          {
            legacyKey:
              typeof entry.id === 'string' && entry.id.trim()
                ? entry.id
                : `legacy-inbox-${index}-${text}`,
            text,
            kind: entry.kind === 'note' ? 'note' : 'task',
            lane: toLane(entry.bucket),
            status:
              entry.status === 'linked'
                ? 'today'
                : entry.status === 'done'
                  ? 'done'
                  : entry.status === 'archived'
                    ? 'archived'
                    : 'inbox',
            sourceDate: toIsoDate(entry.sourceDate, updatedAt.slice(0, 10)),
            targetDate:
              typeof entry.linkedDate === 'string' && entry.linkedDate.trim()
                ? entry.linkedDate
                : null,
            targetTime: null,
            routineLegacyKey: null,
            createdAt: toIsoTimestamp(entry.createdAt, updatedAt),
            updatedAt,
            doneAt: entry.status === 'done' ? updatedAt : null,
            archivedAt: entry.status === 'archived' ? updatedAt : null,
            notes: '',
            attachments: [],
          } satisfies LegacyPrototypeItem,
        ];
      },
    ),
  );

  return workspace;
}

function normalizeLegacyPrototypeWorkspace(raw: unknown): LegacyPrototypeWorkspace {
  if (
    raw &&
    typeof raw === 'object' &&
    'days' in raw &&
    'items' in raw &&
    'settings' in raw
  ) {
    return normalizeCurrentLikeWorkspace(raw);
  }

  return migrateLegacyV2Workspace(raw);
}

function summarizeWorkspace(
  workspace: LegacyPrototypeWorkspace,
): LegacyPrototypeSummary {
  return {
    attachmentCount: workspace.items.reduce(
      (count, item) => count + item.attachments.length,
      0,
    ),
    dayCount: Object.keys(workspace.days).length,
    itemCount: workspace.items.length,
    noteCount: workspace.items.filter((item) => item.kind === 'note').length,
    routineCount: workspace.settings.routines.length,
    taskCount: workspace.items.filter((item) => item.kind === 'task').length,
    weekCount: Object.keys(workspace.weeks).length,
  };
}

function mergeText(current: string, imported: string): string {
  return current.trim() ? current : imported;
}

function mergeDailyRecord(
  current: DailyRecord,
  imported: DailyRecord,
): DailyRecord {
  return DailyRecordSchema.parse({
    ...current,
    startedAt: current.startedAt ?? imported.startedAt,
    closedAt: current.closedAt ?? imported.closedAt,
    readiness: {
      water: current.readiness.water || imported.readiness.water,
      food: current.readiness.food || imported.readiness.food,
      supplements:
        current.readiness.supplements || imported.readiness.supplements,
      hygiene: current.readiness.hygiene || imported.readiness.hygiene,
      movement: current.readiness.movement || imported.readiness.movement,
      sleepSetup:
        current.readiness.sleepSetup || imported.readiness.sleepSetup,
    },
    focusItemIds: Array.from(
      new Set([...current.focusItemIds, ...imported.focusItemIds]),
    ),
    launchNote: mergeText(current.launchNote, imported.launchNote),
    closeWin: mergeText(current.closeWin, imported.closeWin),
    closeCarry: mergeText(current.closeCarry, imported.closeCarry),
    closeSeed: mergeText(current.closeSeed, imported.closeSeed),
    closeNote: mergeText(current.closeNote, imported.closeNote),
    seededRoutineIds: Array.from(
      new Set([...current.seededRoutineIds, ...imported.seededRoutineIds]),
    ),
    updatedAt:
      imported.updatedAt > current.updatedAt ? imported.updatedAt : current.updatedAt,
    syncState: 'pending',
  });
}

function mergeWeeklyRecord(
  current: WeeklyRecord,
  imported: WeeklyRecord,
): WeeklyRecord {
  return WeeklyRecordSchema.parse({
    ...current,
    focus: mergeText(current.focus, imported.focus),
    protect: mergeText(current.protect, imported.protect),
    notes: mergeText(current.notes, imported.notes),
    updatedAt:
      imported.updatedAt > current.updatedAt ? imported.updatedAt : current.updatedAt,
    syncState: 'pending',
  });
}

function mergeSettingsRecord(
  current: SettingsRecord,
  imported: SettingsRecord,
): SettingsRecord {
  return SettingsRecordSchema.parse({
    ...current,
    direction: mergeText(current.direction, imported.direction),
    standards: mergeText(current.standards, imported.standards),
    why: mergeText(current.why, imported.why),
    updatedAt:
      imported.updatedAt > current.updatedAt ? imported.updatedAt : current.updatedAt,
    syncState: 'pending',
  });
}

function defaultSettingsRecord(): SettingsRecord {
  const timestamp = nowIso();

  return SettingsRecordSchema.parse({
    id: SETTINGS_ROW_ID,
    schemaVersion: SCHEMA_VERSION,
    direction: '',
    standards: '',
    why: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    syncState: 'pending',
  });
}

function createMutationRecord(
  entity: MutationRecord['entity'],
  entityId: string,
  type: string,
  payload: Record<string, unknown>,
): MutationRecord {
  return MutationRecordSchema.parse({
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    entity,
    entityId,
    type,
    payload,
    createdAt: nowIso(),
    status: 'pending',
    attempts: 0,
    lastError: null,
  });
}

async function deterministicId(
  scope: string,
  key: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${scope}:${key}`),
  );
  const bytes = new Uint8Array(digest.slice(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  );

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

function readLegacyPrototypeBrowserRaw(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(LEGACY_PROTOTYPE_STORAGE_KEY);
}

function parseLegacyPrototypeJson(
  raw: string,
  failureMessage: string,
): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(failureMessage);
  }
}

export function getLegacyPrototypeBrowserSummary():
  | LegacyPrototypeSummary
  | null {
  const raw = readLegacyPrototypeBrowserRaw();
  if (!raw) {
    return null;
  }

  const workspace = normalizeLegacyPrototypeWorkspace(
    parseLegacyPrototypeJson(
      raw,
      'Earlier prototype data on this browser could not be read.',
    ),
  );
  return summarizeWorkspace(workspace);
}

export async function importLegacyPrototypeData(
  raw: unknown,
): Promise<LegacyPrototypeImportResult> {
  const workspace = normalizeLegacyPrototypeWorkspace(raw);
  const summary = summarizeWorkspace(workspace);
  const routineIdByLegacyKey = new Map<string, string>();
  const itemIdByLegacyKey = new Map<string, string>();
  const attachmentIdsByLegacyKey = new Map<
    string,
    {
      attachmentId: string;
      blobId: string;
    }
  >();

  for (const routine of workspace.settings.routines) {
    routineIdByLegacyKey.set(
      routine.legacyKey,
      await deterministicId('prototype-routine', routine.legacyKey),
    );
  }

  for (const item of workspace.items) {
    itemIdByLegacyKey.set(
      item.legacyKey,
      await deterministicId('prototype-item', item.legacyKey),
    );

    for (const attachment of item.attachments) {
      attachmentIdsByLegacyKey.set(`${item.legacyKey}:${attachment.legacyKey}`, {
        attachmentId: await deterministicId(
          'prototype-attachment',
          `${item.legacyKey}:${attachment.legacyKey}`,
        ),
        blobId: await deterministicId(
          'prototype-attachment-blob',
          `${item.legacyKey}:${attachment.legacyKey}`,
        ),
      });
    }
  }

  const result: LegacyPrototypeImportResult = {
    attachmentsImported: 0,
    attachmentsSkipped: 0,
    daysCreated: 0,
    daysMerged: 0,
    itemsImported: 0,
    itemsSkipped: 0,
    routinesImported: 0,
    routinesSkipped: 0,
    settingsUpdated: false,
    summary,
    weeksCreated: 0,
    weeksMerged: 0,
  };

  await db.transaction(
    'rw',
    [
      db.items,
      db.dailyRecords,
      db.weeklyRecords,
      db.routines,
      db.settings,
      db.attachments,
      db.attachmentBlobs,
      db.mutationQueue,
      db.syncState,
    ],
    async () => {
      const syncState =
        (await db.syncState.get(SYNC_STATE_ROW_ID)) ??
        createDefaultSyncState(getSupabaseSyncStatus());
      if (!(await db.syncState.get(SYNC_STATE_ROW_ID))) {
        await db.syncState.put(syncState);
      }

      for (const routine of workspace.settings.routines) {
        const routineId = routineIdByLegacyKey.get(routine.legacyKey)!;
        const existing = await db.routines.get(routineId);
        if (existing) {
          result.routinesSkipped += 1;
          continue;
        }

        const record = RoutineRecordSchema.parse({
          id: routineId,
          schemaVersion: SCHEMA_VERSION,
          title: routine.text,
          lane: routine.lane,
          destination: routine.destination,
          weekdays: routine.weekdays,
          scheduledTime: routine.scheduledTime,
          notes: routine.notes,
          active: routine.active,
          createdAt: routine.createdAt,
          updatedAt: routine.updatedAt,
          deletedAt: null,
          syncState: 'pending',
        });

        await db.routines.put(record);
        await db.mutationQueue.put(
          createMutationRecord('routine', record.id, 'routine.recovered', {
            routineId: record.id,
          }),
        );
        result.routinesImported += 1;
      }

      for (const item of workspace.items) {
        const itemId = itemIdByLegacyKey.get(item.legacyKey)!;
        const existing = await db.items.get(itemId);

        if (!existing) {
          const record = ItemRecordSchema.parse({
            id: itemId,
            schemaVersion: SCHEMA_VERSION,
            title: item.text,
            kind: item.kind,
            lane: item.lane,
            status: toCurrentStatus(item.status),
            body: item.notes,
            sourceText: null,
            sourceItemId: null,
            captureMode: null,
            sourceDate: item.sourceDate,
            scheduledDate:
              item.targetDate ??
              (item.status === 'today' ? item.sourceDate : null),
            scheduledTime: item.targetTime,
            routineId: item.routineLegacyKey
              ? (routineIdByLegacyKey.get(item.routineLegacyKey) ?? null)
              : null,
            completedAt: item.doneAt,
            archivedAt: item.archivedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            deletedAt: null,
            syncState: 'pending',
          });

          await db.items.put(record);
          await db.mutationQueue.put(
            createMutationRecord('item', record.id, 'item.recovered', {
              itemId: record.id,
            }),
          );
          result.itemsImported += 1;
        } else {
          result.itemsSkipped += 1;
        }

        for (const attachment of item.attachments) {
          const key = `${item.legacyKey}:${attachment.legacyKey}`;
          const { attachmentId, blobId } = attachmentIdsByLegacyKey.get(key)!;
          const existingAttachment = await db.attachments.get(attachmentId);
          if (existingAttachment) {
            result.attachmentsSkipped += 1;
            continue;
          }

          const blob = dataUrlToBlob(attachment.dataUrl);

          await db.attachmentBlobs.put(
            AttachmentBlobRecordSchema.parse({
              id: blobId,
              schemaVersion: SCHEMA_VERSION,
              blob,
              createdAt: item.updatedAt,
            }),
          );
          await db.attachments.put(
            AttachmentRecordSchema.parse({
              id: attachmentId,
              schemaVersion: SCHEMA_VERSION,
              itemId,
              blobId,
              kind: attachmentKind(attachment.type),
              name: attachment.name,
              mimeType: attachment.type,
              size: attachment.size || blob.size,
              createdAt: item.updatedAt,
              updatedAt: item.updatedAt,
              deletedAt: null,
              syncState: 'pending',
            }),
          );
          await db.mutationQueue.put(
            createMutationRecord(
              'attachment',
              attachmentId,
              'attachment.recovered',
              {
                attachmentId,
                itemId,
              },
            ),
          );
          result.attachmentsImported += 1;
        }
      }

      for (const legacyDay of Object.values(workspace.days)) {
        const imported = DailyRecordSchema.parse({
          date: legacyDay.date,
          schemaVersion: SCHEMA_VERSION,
          startedAt: legacyDay.startedAt,
          closedAt: legacyDay.closedAt,
          readiness: legacyDay.readiness,
          focusItemIds: legacyDay.focusLegacyKeys
            .map((legacyKey) => itemIdByLegacyKey.get(legacyKey) ?? null)
            .filter((value): value is string => Boolean(value)),
          launchNote: legacyDay.launchNote,
          closeWin: legacyDay.closeWin,
          closeCarry: legacyDay.closeCarry,
          closeSeed: legacyDay.closeSeed,
          closeNote: legacyDay.closeNote,
          seededRoutineIds: legacyDay.seededRoutineLegacyKeys
            .map((legacyKey) => routineIdByLegacyKey.get(legacyKey) ?? null)
            .filter((value): value is string => Boolean(value)),
          createdAt: legacyDay.createdAt,
          updatedAt: legacyDay.updatedAt,
          syncState: 'pending',
        });
        const current = await db.dailyRecords.get(legacyDay.date);

        if (!current) {
          await db.dailyRecords.put(imported);
          await db.mutationQueue.put(
            createMutationRecord(
              'dailyRecord',
              imported.date,
              'daily.recovered',
              { date: imported.date },
            ),
          );
          result.daysCreated += 1;
          continue;
        }

        const merged = mergeDailyRecord(current, imported);
        if (JSON.stringify(merged) !== JSON.stringify(current)) {
          await db.dailyRecords.put(merged);
          await db.mutationQueue.put(
            createMutationRecord(
              'dailyRecord',
              merged.date,
              'daily.recovered',
              { date: merged.date },
            ),
          );
          result.daysMerged += 1;
        }
      }

      for (const legacyWeek of Object.values(workspace.weeks)) {
        const imported = WeeklyRecordSchema.parse({
          weekStart: legacyWeek.weekStart,
          schemaVersion: SCHEMA_VERSION,
          focus: legacyWeek.focus,
          protect: legacyWeek.protect,
          notes: legacyWeek.notes,
          createdAt: legacyWeek.createdAt,
          updatedAt: legacyWeek.updatedAt,
          syncState: 'pending',
        });
        const current = await db.weeklyRecords.get(legacyWeek.weekStart);

        if (!current) {
          await db.weeklyRecords.put(imported);
          await db.mutationQueue.put(
            createMutationRecord(
              'weeklyRecord',
              imported.weekStart,
              'weekly.recovered',
              { weekStart: imported.weekStart },
            ),
          );
          result.weeksCreated += 1;
          continue;
        }

        const merged = mergeWeeklyRecord(current, imported);
        if (JSON.stringify(merged) !== JSON.stringify(current)) {
          await db.weeklyRecords.put(merged);
          await db.mutationQueue.put(
            createMutationRecord(
              'weeklyRecord',
              merged.weekStart,
              'weekly.recovered',
              { weekStart: merged.weekStart },
            ),
          );
          result.weeksMerged += 1;
        }
      }

      const currentSettings =
        (await db.settings.get(SETTINGS_ROW_ID)) ?? defaultSettingsRecord();
      const importedSettings = SettingsRecordSchema.parse({
        id: SETTINGS_ROW_ID,
        schemaVersion: SCHEMA_VERSION,
        direction: workspace.settings.direction,
        standards: workspace.settings.standards,
        why: workspace.settings.why,
        createdAt: currentSettings.createdAt,
        updatedAt: currentSettings.updatedAt,
        syncState: 'pending',
      });
      const mergedSettings = mergeSettingsRecord(
        currentSettings,
        importedSettings,
      );

      if (JSON.stringify(mergedSettings) !== JSON.stringify(currentSettings)) {
        await db.settings.put(mergedSettings);
        await db.mutationQueue.put(
          createMutationRecord(
            'settings',
            SETTINGS_ROW_ID,
            'settings.recovered',
            { id: SETTINGS_ROW_ID },
          ),
        );
        result.settingsUpdated = true;
      } else if (!(await db.settings.get(SETTINGS_ROW_ID))) {
        await db.settings.put(currentSettings);
      }
    },
  );

  return result;
}

export async function importLegacyPrototypeFromBrowserStorage(): Promise<LegacyPrototypeImportResult> {
  const raw = readLegacyPrototypeBrowserRaw();
  if (!raw) {
    throw new Error(
      'No earlier prototype data was found on this browser and origin.',
    );
  }

  return importLegacyPrototypeData(
    parseLegacyPrototypeJson(
      raw,
      'Earlier prototype data on this browser could not be read.',
    ),
  );
}

export async function importLegacyPrototypeBackupFile(
  file: File,
): Promise<LegacyPrototypeImportResult> {
  const text = await file.text();
  return importLegacyPrototypeData(
    parseLegacyPrototypeJson(
      text,
      'That backup file could not be read.',
    ),
  );
}
