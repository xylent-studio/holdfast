import { addDays, todayDateKey, type DateKey } from '@/domain/dates';
import type { ItemKind, ListItemRecord, ListRecord } from '@/domain/schemas/records';

export type PlacementChoice =
  | 'inbox'
  | 'now'
  | 'scheduled'
  | 'undated'
  | 'waiting'
  | 'list'
  | 'archive';

export type ItemSurfaceContext =
  | { route: 'inbox' }
  | { route: 'now'; section: 'focus' | 'in-play' | 'overdue' }
  | { route: 'upcoming'; section: 'scheduled' | 'undated' | 'waiting' }
  | { route: 'review' }
  | { route: 'list'; listId?: string | null };

export type SurfaceActionId =
  | 'focus'
  | 'remove-focus'
  | 'bring-to-now'
  | 'schedule'
  | 'move-to-waiting'
  | 'keep-in-upcoming'
  | 'archive'
  | 'remove-from-now'
  | 'unschedule'
  | 'now'
  | 'scheduled'
  | 'undated'
  | 'waiting'
  | 'list';

export type SurfaceActionTone = 'accent' | 'ghost' | 'danger' | 'chip';
export type SurfaceActionPriority = 'primary' | 'secondary' | 'overflow';

export interface SurfaceActionSpec {
  id: SurfaceActionId;
  label: string;
  priority: SurfaceActionPriority;
  tone: SurfaceActionTone;
}

export interface PlacementOptionSpec {
  choice: PlacementChoice;
  current: boolean;
  label: string;
}

export function focusActionLabel(currentDate: DateKey): string {
  return currentDate === todayDateKey() ? 'Focus now' : 'Focus for this day';
}

export function defaultUpcomingScheduleDate(currentDate: DateKey): DateKey {
  const today = todayDateKey();
  return currentDate > today ? currentDate : addDays(today, 1);
}

export function inboxPlacementActionSpecs(): SurfaceActionSpec[] {
  return [
    { id: 'now', label: 'Now', priority: 'secondary', tone: 'chip' },
    { id: 'scheduled', label: 'Schedule', priority: 'primary', tone: 'chip' },
    { id: 'undated', label: 'Keep undated', priority: 'secondary', tone: 'chip' },
    { id: 'waiting', label: 'Waiting on', priority: 'secondary', tone: 'chip' },
    { id: 'list', label: 'List', priority: 'secondary', tone: 'chip' },
    { id: 'archive', label: 'Archive', priority: 'overflow', tone: 'chip' },
  ];
}

export function itemCardActionSpecs(
  context: ItemSurfaceContext,
  currentDate: DateKey,
): SurfaceActionSpec[] {
  switch (context.route) {
    case 'now': {
      switch (context.section) {
        case 'focus':
          return [
            {
              id: 'remove-focus',
              label: 'Remove focus',
              priority: 'secondary',
              tone: 'ghost',
            },
          ];
        case 'in-play':
          return [
            {
              id: 'focus',
              label: focusActionLabel(currentDate),
              priority: 'primary',
              tone: 'accent',
            },
          ];
        case 'overdue':
          return [
            {
              id: 'bring-to-now',
              label: 'Bring to Now',
              priority: 'primary',
              tone: 'accent',
            },
          ];
      }
      return [];
    }

    case 'upcoming': {
      switch (context.section) {
        case 'scheduled':
          return [
            {
              id: 'bring-to-now',
              label: 'Bring to Now',
              priority: 'primary',
              tone: 'accent',
            },
            {
              id: 'move-to-waiting',
              label: 'Move to Waiting on',
              priority: 'secondary',
              tone: 'ghost',
            },
            {
              id: 'archive',
              label: 'Archive',
              priority: 'overflow',
              tone: 'ghost',
            },
          ];
        case 'undated':
          return [
            {
              id: 'schedule',
              label: 'Schedule',
              priority: 'primary',
              tone: 'accent',
            },
            {
              id: 'bring-to-now',
              label: 'Bring to Now',
              priority: 'secondary',
              tone: 'ghost',
            },
            {
              id: 'move-to-waiting',
              label: 'Move to Waiting on',
              priority: 'overflow',
              tone: 'ghost',
            },
            {
              id: 'archive',
              label: 'Archive',
              priority: 'overflow',
              tone: 'ghost',
            },
          ];
        case 'waiting':
          return [
            {
              id: 'bring-to-now',
              label: 'Bring to Now',
              priority: 'primary',
              tone: 'accent',
            },
            {
              id: 'keep-in-upcoming',
              label: 'Keep in Upcoming',
              priority: 'secondary',
              tone: 'ghost',
            },
            {
              id: 'archive',
              label: 'Archive',
              priority: 'overflow',
              tone: 'ghost',
            },
          ];
      }
      return [];
    }

    default:
      return [];
  }
}

export function placementOptionSpecs(
  context: ItemSurfaceContext,
  currentPlacement: PlacementChoice,
  kind: ItemKind,
): PlacementOptionSpec[] {
  const labels: Record<PlacementChoice, string> = {
    inbox:
      context.route === 'inbox' || currentPlacement === 'inbox'
        ? 'Keep in Inbox'
        : 'Send to Inbox',
    now: currentPlacement === 'now' ? 'Keep in Now' : 'Bring to Now',
    scheduled: currentPlacement === 'scheduled' ? 'Keep scheduled' : 'Schedule',
    undated: 'Keep undated',
    waiting:
      context.route === 'upcoming' && context.section === 'waiting'
        ? 'Keep waiting'
        : currentPlacement === 'waiting'
          ? 'Keep waiting'
          : 'Move to Waiting on',
    list: 'Convert to list item',
    archive: 'Archive',
  };

  const orderByRoute: Record<ItemSurfaceContext['route'], PlacementChoice[]> = {
    inbox: ['inbox', 'now', 'scheduled', 'undated', 'waiting', 'list', 'archive'],
    now: ['now', 'scheduled', 'undated', 'waiting', 'inbox', 'list', 'archive'],
    upcoming:
      context.route === 'upcoming' && context.section === 'scheduled'
        ? ['scheduled', 'now', 'waiting', 'undated', 'inbox', 'list', 'archive']
        : context.route === 'upcoming' && context.section === 'undated'
          ? ['undated', 'scheduled', 'now', 'waiting', 'inbox', 'list', 'archive']
          : ['waiting', 'now', 'undated', 'scheduled', 'inbox', 'list', 'archive'],
    review: ['inbox', 'now', 'scheduled', 'undated', 'waiting', 'list', 'archive'],
    list: ['inbox', 'now', 'scheduled', 'undated', 'waiting', 'list', 'archive'],
  };

  const visibleChoices =
    kind === 'capture'
      ? ['inbox', 'list', 'archive']
      : ['inbox', 'now', 'scheduled', 'undated', 'waiting', 'list', 'archive'];

  return orderByRoute[context.route]
    .filter((choice) => visibleChoices.includes(choice))
    .map((choice) => ({
      choice,
      current: choice === currentPlacement,
      label: labels[choice],
    }));
}

export function listItemMoveActionSpecs({
  list,
  listItem,
  wholeListActive,
}: {
  list: ListRecord;
  listItem: ListItemRecord;
  wholeListActive: boolean;
}): SurfaceActionSpec[] {
  if (list.kind === 'reference' || listItem.status !== 'open') {
    return [];
  }

  if (listItem.nowDate) {
    return [
      {
        id: 'remove-from-now',
        label: 'Remove from Now',
        priority: 'secondary',
        tone: 'ghost',
      },
    ];
  }

  if (wholeListActive) {
    return [];
  }

  return [
    {
      id: 'bring-to-now',
      label: 'Bring to Now',
      priority: 'secondary',
      tone: 'ghost',
    },
  ];
}

export function wholeListMoveActionSpecs({
  currentDate,
  isFocused,
  list,
}: {
  currentDate: DateKey;
  isFocused: boolean;
  list: ListRecord;
}): SurfaceActionSpec[] {
  const actions: SurfaceActionSpec[] = [];

  if (!list.scheduledDate || list.scheduledDate > currentDate) {
    actions.push({
      id: 'bring-to-now',
      label: 'Bring to Now',
      priority: list.scheduledDate && list.scheduledDate > currentDate ? 'primary' : 'secondary',
      tone: list.scheduledDate && list.scheduledDate > currentDate ? 'accent' : 'ghost',
    });
  }

  actions.push(
    isFocused
      ? {
          id: 'remove-focus',
          label: 'Remove focus',
          priority: 'secondary',
          tone: 'ghost',
        }
      : {
          id: 'focus',
          label: focusActionLabel(currentDate),
          priority: 'secondary',
          tone: 'ghost',
        },
  );

  if (list.scheduledDate) {
    actions.push({
      id: list.scheduledDate > currentDate ? 'unschedule' : 'remove-from-now',
      label: list.scheduledDate > currentDate ? 'Unschedule' : 'Remove from Now',
      priority: 'overflow',
      tone: 'ghost',
    });
  }

  return actions;
}
