import { resolveQuickDate } from '@/domain/dates';
import type { DateKey } from '@/domain/dates';
import type {
  CaptureMode,
  ItemKind,
  ItemStatus,
  Lane,
} from '@/domain/schemas/records';

export type QuickAddTimingMode =
  | 'tomorrow'
  | 'thisweek'
  | 'nextweek'
  | 'date'
  | 'someday';
export type QuickAddPlacement = 'today' | 'upcoming';

export interface QuickAddDraft {
  captureMode: Extract<CaptureMode, 'context' | 'direct'>;
  chosenDate: DateKey;
  chosenTime: string;
  kind: Extract<ItemKind, 'task' | 'note'>;
  placement: QuickAddPlacement;
  shapeNow: boolean;
  timingMode: QuickAddTimingMode;
}

export interface QuickAddPlanInput {
  rawText: string;
  currentDate: DateKey;
  shapeNow: boolean;
  kind: Extract<ItemKind, 'task' | 'note'>;
  lane?: Lane;
  placement: QuickAddPlacement;
  timingMode: QuickAddTimingMode;
  chosenDate: DateKey;
  chosenTime: string;
  captureMode?: Extract<CaptureMode, 'direct' | 'context'>;
}

export interface PlannedQuickAddItem {
  title: string;
  kind: ItemKind;
  lane: Lane;
  status: ItemStatus;
  body: string;
  sourceText: string;
  sourceItemId: null;
  captureMode: CaptureMode;
  sourceDate: DateKey;
  scheduledDate: DateKey | null;
  scheduledTime: string | null;
}

export function buildQuickAddDraft(
  currentDate: DateKey,
  preferredPlacement: QuickAddPlacement | null,
): QuickAddDraft {
  if (preferredPlacement === 'today') {
    return {
      captureMode: 'context',
      chosenDate: currentDate,
      chosenTime: '',
      kind: 'task',
      placement: 'today',
      shapeNow: true,
      timingMode: 'tomorrow',
    };
  }

  if (preferredPlacement === 'upcoming') {
    return {
      captureMode: 'context',
      chosenDate: currentDate,
      chosenTime: '',
      kind: 'task',
      placement: 'upcoming',
      shapeNow: true,
      timingMode: 'someday',
    };
  }

  return {
    captureMode: 'direct',
    chosenDate: currentDate,
    chosenTime: '',
    kind: 'task',
    placement: 'today',
    shapeNow: false,
    timingMode: 'tomorrow',
  };
}

export function splitCapturedText(
  rawText: string,
): { title: string; body: string; sourceText: string } | null {
  const sourceText = rawText.trim();
  if (!sourceText) {
    return null;
  }

  const [firstLine = '', ...rest] = sourceText.split(/\r?\n/g);

  return {
    title: firstLine.trim(),
    body: rest.join('\n').trim(),
    sourceText,
  };
}

export function planQuickAddItem(
  input: QuickAddPlanInput,
): PlannedQuickAddItem | null {
  const parsed = splitCapturedText(input.rawText);
  if (!parsed) {
    return null;
  }

  if (!input.shapeNow) {
    return {
      title: parsed.title,
      kind: 'capture',
      lane: input.lane ?? 'admin',
      status: 'inbox',
      body: parsed.body,
      sourceText: parsed.sourceText,
      sourceItemId: null,
      captureMode: 'uncertain',
      sourceDate: input.currentDate,
      scheduledDate: null,
      scheduledTime: null,
    };
  }

  const scheduledDate =
    input.placement === 'today'
      ? input.currentDate
      : input.timingMode === 'someday'
        ? null
        : resolveQuickDate(
            input.timingMode,
            input.currentDate,
            input.chosenDate,
          );

  return {
    title: parsed.title,
    kind: input.kind,
    lane: input.lane ?? 'admin',
    status: input.placement,
    body: parsed.body,
    sourceText: parsed.sourceText,
    sourceItemId: null,
    captureMode: input.captureMode ?? 'direct',
    sourceDate: input.currentDate,
    scheduledDate,
    scheduledTime: scheduledDate ? input.chosenTime || null : null,
  };
}
