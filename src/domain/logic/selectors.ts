import { ITEM_STATUS_LABELS, LANES } from '@/domain/constants';
import { addDays, endOfWeek, inWindow, niceDate, niceTime, startOfWeek } from '@/domain/dates';
import type {
  AttachmentRecord,
  DailyRecord,
  ItemRecord,
  Lane,
} from '@/domain/schemas/records';

export type InboxFilter = 'unsorted' | 'open' | 'archived';
export type UpcomingFilter = 'planned' | 'queue' | 'waiting';
export type PlanSpan = 'day' | 'week' | 'month';

export function normalizedText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function openItems<T extends ItemRecord>(items: T[]): T[] {
  return items.filter(
    (item) => !item.deletedAt && ['inbox', 'today', 'upcoming', 'waiting'].includes(item.status),
  );
}

export function itemsForToday<T extends ItemRecord>(items: T[], currentDate: string): T[] {
  return items.filter((item) => {
    if (item.deletedAt || item.status === 'done' || item.status === 'archived') {
      return false;
    }

    if (item.status === 'today') {
      return !item.scheduledDate || item.scheduledDate === currentDate;
    }

    return item.status === 'upcoming' && item.scheduledDate === currentDate;
  });
}

export function getFocusItems<T extends ItemRecord>(day: DailyRecord, items: T[]): T[] {
  return day.focusItemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is T => Boolean(item && !item.deletedAt));
}

export function getQueueItemsForToday<T extends ItemRecord>(
  day: DailyRecord,
  items: T[],
  currentDate: string,
): T[] {
  const focusIds = new Set(day.focusItemIds);
  return itemsForToday(items, currentDate).filter((item) => !focusIds.has(item.id));
}

export function overdueItems<T extends ItemRecord>(items: T[], currentDate: string): T[] {
  return items
    .filter(
      (item) =>
        !item.deletedAt &&
        ['today', 'upcoming', 'waiting'].includes(item.status) &&
        !!item.scheduledDate &&
        item.scheduledDate < currentDate,
    )
    .sort((left, right) =>
      `${left.scheduledDate ?? ''}${left.scheduledTime ?? ''}`.localeCompare(
        `${right.scheduledDate ?? ''}${right.scheduledTime ?? ''}`,
      ),
    );
}

export function nextScheduledItems<T extends ItemRecord>(items: T[], currentDate: string, limit = 4): T[] {
  return items
    .filter(
      (item) =>
        !item.deletedAt &&
        item.status === 'upcoming' &&
        !!item.scheduledDate &&
        item.scheduledDate > currentDate,
    )
    .sort((left, right) =>
      `${left.scheduledDate ?? ''}${left.scheduledTime ?? ''}`.localeCompare(
        `${right.scheduledDate ?? ''}${right.scheduledTime ?? ''}`,
      ),
    )
    .slice(0, limit);
}

export function scheduledUpcomingItems<T extends ItemRecord>(
  items: T[],
  currentDate: string,
  span: PlanSpan,
): T[] {
  return items
    .filter(
      (item) =>
        !item.deletedAt &&
        item.status === 'upcoming' &&
        inWindow(item.scheduledDate, currentDate, span),
    )
    .sort((left, right) =>
      `${left.scheduledDate ?? ''}${left.scheduledTime ?? ''}`.localeCompare(
        `${right.scheduledDate ?? ''}${right.scheduledTime ?? ''}`,
      ),
    );
}

export function queuedUpcomingItems<T extends ItemRecord>(items: T[]): T[] {
  return items.filter((item) => !item.deletedAt && item.status === 'upcoming' && !item.scheduledDate);
}

export function waitingItems<T extends ItemRecord>(items: T[]): T[] {
  return items.filter((item) => !item.deletedAt && item.status === 'waiting');
}

export function inboxItems<T extends ItemRecord>(items: T[], filter: InboxFilter): T[] {
  if (filter === 'archived') {
    return items.filter((item) => item.status === 'archived' && !item.deletedAt);
  }

  if (filter === 'open') {
    return openItems(items);
  }

  return items.filter((item) => item.status === 'inbox' && !item.deletedAt);
}

export function groupScheduledItems<T extends ItemRecord>(items: T[]): Array<{ date: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.scheduledDate ?? 'unscheduled';
    const next = groups.get(key) ?? [];
    next.push(item);
    groups.set(key, next);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groupedItems]) => ({ date, items: groupedItems }));
}

export function repeatedOpenTitles(items: ItemRecord[]): Array<[title: string, count: number]> {
  const counts = new Map<string, { count: number; title: string }>();

  for (const item of openItems(items)) {
    const key = normalizedText(item.title);
    if (!key) {
      continue;
    }

    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { title: item.title, count: 1 });
    }
  }

  return [...counts.values()]
    .filter((entry) => entry.count > 1)
    .sort((left, right) => right.count - left.count)
    .map((entry) => [entry.title, entry.count]);
}

export function recentDaySummaries(
  dailyRecords: DailyRecord[],
  items: ItemRecord[],
  currentDate: string,
  daysBack = 7,
): Array<{
  date: string;
  readinessCount: number;
  focusTitles: string[];
  closeWin: string;
  closeSeed: string;
  closed: boolean;
}> {
  const byDate = new Map(dailyRecords.map((record) => [record.date, record]));

  return Array.from({ length: daysBack }, (_, index) => addDays(currentDate, -index)).map((date) => {
    const record = byDate.get(date);
    const focusTitles =
      record?.focusItemIds
        .map((id) => items.find((item) => item.id === id)?.title)
        .filter((value): value is string => Boolean(value)) ?? [];

    return {
      date,
      readinessCount: record ? Object.values(record.readiness).filter(Boolean).length : 0,
      focusTitles,
      closeWin: record?.closeWin ?? '',
      closeSeed: record?.closeSeed ?? '',
      closed: Boolean(record?.closedAt),
    };
  });
}

export function searchAll<T extends ItemRecord>(
  items: T[],
  dailyRecords: DailyRecord[],
  query: string,
): Array<
  | { type: 'item'; item: T }
  | {
      type: 'day';
      date: string;
      dailyRecord: DailyRecord;
    }
> {
  const needle = normalizedText(query);
  if (!needle) {
    return [];
  }

  const itemResults = items
    .filter((item) => !item.deletedAt)
    .filter((item) =>
      normalizedText(
        [item.title, item.body, item.lane, ITEM_STATUS_LABELS[item.status] ?? item.status].join(' | '),
      ).includes(needle),
    )
    .map((item) => ({ type: 'item', item }) as const);

  const dayResults = dailyRecords
    .filter((record) =>
      normalizedText(
        [record.launchNote, record.closeWin, record.closeCarry, record.closeSeed, record.closeNote].join(
          ' | ',
        ),
      ).includes(needle),
    )
    .map((dailyRecord) => ({ type: 'day', date: dailyRecord.date, dailyRecord }) as const);

  return [...itemResults, ...dayResults].sort((left, right) => {
    const leftTimestamp = left.type === 'item' ? left.item.updatedAt : left.dailyRecord.updatedAt;
    const rightTimestamp = right.type === 'item' ? right.item.updatedAt : right.dailyRecord.updatedAt;
    return rightTimestamp.localeCompare(leftTimestamp);
  });
}

export function carrySuggestions(dailyRecords: DailyRecord[], currentDate: string): Array<{ type: 'seed' | 'carry'; text: string }> {
  const previousDay = dailyRecords.find((record) => record.date === addDays(currentDate, -1));
  if (!previousDay) {
    return [];
  }

  const suggestions: Array<{ type: 'seed' | 'carry'; text: string }> = [];

  if (previousDay.closeSeed.trim()) {
    suggestions.push({ type: 'seed', text: previousDay.closeSeed.trim() });
  }

  for (const line of previousDay.closeCarry.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (trimmed) {
      suggestions.push({ type: 'carry', text: trimmed });
    }
  }

  return suggestions;
}

export function openCountsByLane(items: ItemRecord[]): Record<Lane, number> {
  const counts = Object.fromEntries(LANES.map((lane) => [lane.key, 0])) as Record<Lane, number>;
  for (const item of openItems(items)) {
    counts[item.lane] += 1;
  }
  return counts;
}

export function itemMeta(item: ItemRecord, currentDate: string, attachments: AttachmentRecord[]): string[] {
  const lane = LANES.find((entry) => entry.key === item.lane)?.label ?? 'Admin';
  const status =
    item.status === 'upcoming'
      ? item.scheduledDate
        ? 'Planned'
        : 'Queued'
      : ITEM_STATUS_LABELS[item.status] ?? item.status;

  const parts = [lane, status, niceDate(item.sourceDate)];
  if (item.scheduledDate) {
    if (item.status === 'upcoming' && item.scheduledDate < currentDate) {
      parts.push('Overdue');
    } else if (item.status === 'upcoming' && item.scheduledDate === currentDate) {
      parts.push('Due today');
    } else {
      parts.push(`On ${niceDate(item.scheduledDate)}`);
    }
  }

  if (item.scheduledTime) {
    parts.push(niceTime(item.scheduledTime));
  }

  if (item.body.trim()) {
    parts.push(item.kind === 'note' ? 'Details' : 'Instructions');
  }

  const imageCount = attachments.filter((attachment) => attachment.kind === 'image').length;
  const fileCount = attachments.filter((attachment) => attachment.kind !== 'image').length;

  if (imageCount) {
    parts.push(imageCount === 1 ? '1 photo' : `${imageCount} photos`);
  }

  if (fileCount) {
    parts.push(fileCount === 1 ? '1 file' : `${fileCount} files`);
  }

  return parts;
}

export function currentWeekLabel(currentDate: string): string {
  return `${niceDate(startOfWeek(currentDate))} to ${niceDate(endOfWeek(currentDate))}`;
}
