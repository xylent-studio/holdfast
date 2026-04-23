import { addDays } from '@/domain/dates';
import type { DateKey } from '@/domain/dates';
import type {
  CaptureMode,
  ItemKind,
  ItemStatus,
  Lane,
  ListKind,
} from '@/domain/schemas/records';

export type UpcomingSection = 'scheduled' | 'undated' | 'waiting';
export type AddContext =
  | 'global'
  | 'now'
  | 'upcoming-scheduled'
  | 'upcoming-undated'
  | 'upcoming-waiting'
  | 'list';
export type AddDestination =
  | 'inbox'
  | 'now'
  | 'scheduled'
  | 'undated'
  | 'waiting'
  | 'list'
  | 'new-list';
export type ItemAddDestination = Exclude<AddDestination, 'list' | 'new-list'>;

export const LIST_KIND_OPTIONS: ListKind[] = [
  'replenishment',
  'checklist',
  'project',
  'reference',
];

export interface QuickAddDraft {
  chosenDate: DateKey;
  chosenTime: string;
}

export interface QuickAddPlanInput {
  rawText: string;
  currentDate: DateKey;
  destination: ItemAddDestination;
  chosenDate: DateKey;
  chosenTime: string;
  lane?: Lane;
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

export function buildQuickAddDraft(currentDate: DateKey): QuickAddDraft {
  return {
    chosenDate: addDays(currentDate, 1),
    chosenTime: '',
  };
}

export function parseUpcomingSection(
  value: string | null | undefined,
): UpcomingSection {
  if (value === 'undated' || value === 'waiting') {
    return value;
  }

  return 'scheduled';
}

export function addContextForLocation(
  pathname: string,
  search: string,
): AddContext {
  if (pathname === '/now') {
    return 'now';
  }

  if (pathname === '/upcoming') {
    const section = parseUpcomingSection(
      new URLSearchParams(search).get('section'),
    );
    return `upcoming-${section}`;
  }

  if (pathname.startsWith('/lists/')) {
    return 'list';
  }

  return 'global';
}

export function currentListIdForPath(pathname: string): string | null {
  if (!pathname.startsWith('/lists/')) {
    return null;
  }

  return pathname.slice('/lists/'.length) || null;
}

export function primaryAddDestinationForContext(
  context: AddContext,
): Exclude<AddDestination, 'new-list'> {
  switch (context) {
    case 'now':
      return 'now';
    case 'upcoming-scheduled':
      return 'scheduled';
    case 'upcoming-undated':
      return 'undated';
    case 'upcoming-waiting':
      return 'waiting';
    case 'list':
      return 'list';
    case 'global':
    default:
      return 'inbox';
  }
}

export function destinationLabel(
  destination: AddDestination,
  listTitle?: string | null,
): string {
  switch (destination) {
    case 'inbox':
      return 'Inbox';
    case 'now':
      return 'Now';
    case 'scheduled':
      return 'Scheduled';
    case 'undated':
      return 'Undated';
    case 'waiting':
      return 'Waiting on';
    case 'list':
      return listTitle?.trim() || 'This list';
    case 'new-list':
      return 'New list...';
  }
}

export function destinationActionLabel(
  destination: AddDestination,
  listTitle?: string | null,
): string {
  switch (destination) {
    case 'inbox':
      return 'Save to Inbox';
    case 'now':
      return 'Add to Now';
    case 'scheduled':
      return 'Schedule';
    case 'undated':
      return 'Keep in Upcoming';
    case 'waiting':
      return 'Add to Waiting on';
    case 'list':
      return `Add to ${listTitle?.trim() || 'This list'}`;
    case 'new-list':
      return 'Create list and add first item';
  }
}

export function addContextDescription(
  context: AddContext,
  listTitle?: string | null,
): string {
  switch (context) {
    case 'now':
      return 'You are already in Now. Write first, then either add it here or safely catch it in Inbox.';
    case 'upcoming-scheduled':
      return 'You are already in Scheduled. Write first, then schedule it or safely catch it in Inbox.';
    case 'upcoming-undated':
      return 'You are already in Undated. Write first, then keep it in Upcoming or safely catch it in Inbox.';
    case 'upcoming-waiting':
      return 'You are already in Waiting on. Write first, then keep it there or safely catch it in Inbox.';
    case 'list':
      return `You are already in ${listTitle?.trim() || 'this list'}. Write first, then add it there or safely catch it in Inbox.`;
    case 'global':
    default:
      return 'Catch it first. Place it directly only when the destination is already clear.';
  }
}

export function isContextDestination(
  context: AddContext,
  destination: AddDestination,
  options?: {
    currentListId?: string | null;
    selectedListId?: string | null;
  },
): boolean {
  switch (context) {
    case 'now':
      return destination === 'now';
    case 'upcoming-scheduled':
      return destination === 'scheduled';
    case 'upcoming-undated':
      return destination === 'undated';
    case 'upcoming-waiting':
      return destination === 'waiting';
    case 'list':
      return (
        destination === 'list' &&
        Boolean(options?.currentListId) &&
        options?.currentListId === options?.selectedListId
      );
    case 'global':
    default:
      return destination === 'inbox';
  }
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

  if (input.destination === 'inbox') {
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

  if (input.destination === 'now') {
    return {
      title: parsed.title,
      kind: 'task',
      lane: input.lane ?? 'admin',
      status: 'today',
      body: parsed.body,
      sourceText: parsed.sourceText,
      sourceItemId: null,
      captureMode: input.captureMode ?? 'direct',
      sourceDate: input.currentDate,
      scheduledDate: input.currentDate,
      scheduledTime: null,
    };
  }

  if (input.destination === 'scheduled') {
    return {
      title: parsed.title,
      kind: 'task',
      lane: input.lane ?? 'admin',
      status: 'upcoming',
      body: parsed.body,
      sourceText: parsed.sourceText,
      sourceItemId: null,
      captureMode: input.captureMode ?? 'direct',
      sourceDate: input.currentDate,
      scheduledDate: input.chosenDate,
      scheduledTime: input.chosenTime || null,
    };
  }

  return {
    title: parsed.title,
    kind: 'task',
    lane: input.lane ?? 'admin',
    status: input.destination === 'waiting' ? 'waiting' : 'upcoming',
    body: parsed.body,
    sourceText: parsed.sourceText,
    sourceItemId: null,
    captureMode: input.captureMode ?? 'direct',
    sourceDate: input.currentDate,
    scheduledDate: null,
    scheduledTime: null,
  };
}
