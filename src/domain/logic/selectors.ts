import { ITEM_STATUS_LABELS, LANES } from '@/domain/constants';
import {
  addDays,
  endOfWeek,
  inWindow,
  niceDate,
  niceTime,
  startOfWeek,
} from '@/domain/dates';
import type {
  AttachmentRecord,
  DailyRecord,
  ItemRecord,
  Lane,
  ListItemRecord,
  ListRecord,
} from '@/domain/schemas/records';

export type InboxFilter = 'unsorted' | 'open' | 'archived';
export type UpcomingFilter = 'scheduled' | 'undated' | 'waiting';
export type PlanSpan = 'day' | 'week' | 'month';
export type ReviewableItem = ItemRecord & {
  attachments?: AttachmentRecord[];
};
export type ReviewSearchResult<T extends ItemRecord = ItemRecord> =
  | { type: 'item'; item: T }
  | {
      type: 'day';
      date: string;
      dailyRecord: DailyRecord;
    }
  | {
      type: 'list';
      list: ListRecord;
      openCount: number;
      doneCount: number;
    }
  | {
      type: 'listItem';
      list: ListRecord;
      listItem: ListItemRecord;
    };

export function normalizedText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function openItems<T extends ItemRecord>(items: T[]): T[] {
  return items.filter(
    (item) =>
      !item.deletedAt &&
      ['inbox', 'today', 'upcoming', 'waiting'].includes(item.status),
  );
}

export function itemsForToday<T extends ItemRecord>(
  items: T[],
  currentDate: string,
): T[] {
  return items.filter((item) => {
    if (
      item.deletedAt ||
      item.kind === 'capture' ||
      item.status === 'done' ||
      item.status === 'archived'
    ) {
      return false;
    }

    if (item.status === 'today') {
      return !item.scheduledDate || item.scheduledDate === currentDate;
    }

    return item.status === 'upcoming' && item.scheduledDate === currentDate;
  });
}

export function getFocusItems<T extends ItemRecord>(
  day: DailyRecord,
  items: T[],
): T[] {
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
  return itemsForToday(items, currentDate).filter(
    (item) => !focusIds.has(item.id),
  );
}

export function overdueItems<T extends ItemRecord>(
  items: T[],
  currentDate: string,
): T[] {
  return items
    .filter(
      (item) =>
        !item.deletedAt &&
        item.kind !== 'capture' &&
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

export function conflictedItems<T extends ItemRecord>(items: T[]): T[] {
  return items
    .filter((item) => !item.deletedAt && item.syncState === 'conflict')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function conflictedLists<T extends ListRecord>(lists: T[]): T[] {
  return lists
    .filter((list) => !list.deletedAt && list.syncState === 'conflict')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function conflictedListItems<T extends ListItemRecord>(
  listItems: T[],
): T[] {
  return listItems
    .filter((listItem) => !listItem.deletedAt && listItem.syncState === 'conflict')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function nextScheduledItems<T extends ItemRecord>(
  items: T[],
  currentDate: string,
  limit = 4,
): T[] {
  return items
    .filter(
      (item) =>
        !item.deletedAt &&
        item.kind !== 'capture' &&
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
        item.kind !== 'capture' &&
        item.status === 'upcoming' &&
        inWindow(item.scheduledDate, currentDate, span),
    )
    .sort((left, right) =>
      `${left.scheduledDate ?? ''}${left.scheduledTime ?? ''}`.localeCompare(
        `${right.scheduledDate ?? ''}${right.scheduledTime ?? ''}`,
      ),
    );
}

export function undatedUpcomingItems<T extends ItemRecord>(items: T[]): T[] {
  return items.filter(
    (item) =>
      !item.deletedAt &&
      item.kind !== 'capture' &&
      item.status === 'upcoming' &&
      !item.scheduledDate,
  );
}

export const queuedUpcomingItems = undatedUpcomingItems;

export function waitingItems<T extends ItemRecord>(items: T[]): T[] {
  return items.filter(
    (item) =>
      !item.deletedAt && item.kind !== 'capture' && item.status === 'waiting',
  );
}

export function inboxItems<T extends ItemRecord>(
  items: T[],
  filter: InboxFilter,
): T[] {
  if (filter === 'archived') {
    return items.filter(
      (item) => item.status === 'archived' && !item.deletedAt,
    );
  }

  if (filter === 'open') {
    return openItems(items);
  }

  return items.filter((item) => item.status === 'inbox' && !item.deletedAt);
}

export function groupScheduledItems<T extends ItemRecord>(
  items: T[],
): Array<{ date: string; items: T[] }> {
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

export function repeatedOpenTitles(
  items: ItemRecord[],
): Array<[title: string, count: number]> {
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
  carryCount: number;
  date: string;
  focusTitles: string[];
  closeWin: string;
  closeSeed: string;
  closed: boolean;
}> {
  const byDate = new Map(dailyRecords.map((record) => [record.date, record]));

  return Array.from({ length: daysBack }, (_, index) =>
    addDays(currentDate, -index),
  ).map((date) => {
    const record = byDate.get(date);
    const focusTitles =
      record?.focusItemIds
        .map((id) => items.find((item) => item.id === id)?.title)
        .filter((value): value is string => Boolean(value)) ?? [];

    return {
      carryCount: record
        ? record.closeCarry
            .split(/\r?\n/g)
            .map((line) => line.trim())
            .filter(Boolean).length
        : 0,
      date,
      focusTitles,
      closeWin: record?.closeWin ?? '',
      closeSeed: record?.closeSeed ?? '',
      closed: Boolean(record?.closedAt),
    };
  });
}

export function searchWorkspace<T extends ReviewableItem>(
  items: T[],
  dailyRecords: DailyRecord[],
  lists: ListRecord[],
  listItems: ListItemRecord[],
  query: string,
): ReviewSearchResult<T>[] {
  const needle = normalizedText(query);
  if (!needle) {
    return [];
  }

  const itemResults = items
    .filter((item) => !item.deletedAt)
    .filter((item) =>
      normalizedText(
        [
          item.title,
          item.body,
          item.sourceText ?? '',
          ...(item.attachments ?? []).map((attachment) => attachment.name),
          ITEM_STATUS_LABELS[item.status] ?? item.status,
        ].join(' | '),
      ).includes(needle),
    )
    .map((item) => ({ type: 'item', item }) as const satisfies ReviewSearchResult<T>);

  const dayResults = dailyRecords
    .filter((record) =>
      normalizedText(
        [
          record.launchNote,
          record.closeWin,
          record.closeCarry,
          record.closeSeed,
          record.closeNote,
        ].join(' | '),
      ).includes(needle),
    )
    .map(
      (dailyRecord) =>
        ({
          type: 'day',
          date: dailyRecord.date,
          dailyRecord,
        }) as const satisfies ReviewSearchResult<T>,
    );

  const activeLists = lists.filter((list) => !list.deletedAt);
  const activeListItems = listItems.filter(
    (listItem) => !listItem.deletedAt && listItem.status !== 'archived',
  );
  const itemsByListId = new Map<string, ListItemRecord[]>();
  for (const listItem of activeListItems) {
    const next = itemsByListId.get(listItem.listId) ?? [];
    next.push(listItem);
    itemsByListId.set(listItem.listId, next);
  }

  const listResults = activeLists
    .filter((list) =>
      normalizedText([list.title, list.kind].join(' | ')).includes(needle),
    )
    .map((list) => {
      const relatedItems = itemsByListId.get(list.id) ?? [];
      return {
        type: 'list',
        list,
        openCount: relatedItems.filter((entry) => entry.status === 'open')
          .length,
        doneCount: relatedItems.filter((entry) => entry.status === 'done')
          .length,
      } as const satisfies ReviewSearchResult<T>;
    });

  const listLookup = new Map(activeLists.map((list) => [list.id, list]));
  const listItemResults = activeListItems
    .map((listItem) => ({
      list: listLookup.get(listItem.listId) ?? null,
      listItem,
    }))
    .filter(
      (
        entry,
      ): entry is {
        list: ListRecord;
        listItem: ListItemRecord;
      } => Boolean(entry.list),
    )
    .filter(({ list, listItem }) =>
      normalizedText(
        [listItem.title, listItem.body, list.title, list.kind].join(' | '),
      ).includes(needle),
    )
    .map(
      ({ list, listItem }) =>
        ({ type: 'listItem', list, listItem }) as const satisfies ReviewSearchResult<T>,
    );

  return [
    ...itemResults,
    ...dayResults,
    ...listResults,
    ...listItemResults,
  ].sort((left, right) => {
    const leftTimestamp = (() => {
      switch (left.type) {
        case 'item':
          return left.item.updatedAt;
        case 'day':
          return left.dailyRecord.updatedAt;
        case 'list':
          return left.list.updatedAt;
        case 'listItem':
          return left.listItem.updatedAt;
      }
    })();
    const rightTimestamp = (() => {
      switch (right.type) {
        case 'item':
          return right.item.updatedAt;
        case 'day':
          return right.dailyRecord.updatedAt;
        case 'list':
          return right.list.updatedAt;
        case 'listItem':
          return right.listItem.updatedAt;
      }
    })();
    return rightTimestamp.localeCompare(leftTimestamp);
  });
}

export function carrySuggestions(
  dailyRecords: DailyRecord[],
  currentDate: string,
): Array<{ type: 'seed'; text: string }> {
  const previousDay = dailyRecords.find(
    (record) => record.date === addDays(currentDate, -1),
  );
  if (!previousDay) {
    return [];
  }

  const suggestions: Array<{ type: 'seed'; text: string }> = [];

  if (previousDay.closeSeed.trim()) {
    suggestions.push({ type: 'seed', text: previousDay.closeSeed.trim() });
  }

  return suggestions;
}

export function reviewListSummaries(
  lists: ListRecord[],
  listItems: ListItemRecord[],
  limit = 6,
): Array<{
  list: ListRecord;
  openCount: number;
  doneCount: number;
  previewTitles: string[];
}> {
  const activeLists = lists.filter((list) => !list.deletedAt && !list.archivedAt);
  const itemsByListId = new Map<string, ListItemRecord[]>();

  for (const listItem of listItems.filter((entry) => !entry.deletedAt)) {
    const next = itemsByListId.get(listItem.listId) ?? [];
    next.push(listItem);
    itemsByListId.set(listItem.listId, next);
  }

  return activeLists
    .map((list) => {
      const relatedItems = (itemsByListId.get(list.id) ?? []).filter(
        (entry) => entry.status !== 'archived',
      );
      const orderedOpenItems = relatedItems
        .filter((entry) => entry.status === 'open')
        .sort((left, right) => left.position - right.position);

      return {
        list,
        openCount: orderedOpenItems.length,
        doneCount: relatedItems.filter((entry) => entry.status === 'done')
          .length,
        previewTitles: orderedOpenItems.slice(0, 3).map((entry) => entry.title),
      };
    })
    .sort((left, right) => {
      if (left.list.pinned !== right.list.pinned) {
        return left.list.pinned ? -1 : 1;
      }

      return right.list.updatedAt.localeCompare(left.list.updatedAt);
    })
    .slice(0, limit);
}

export function openCountsByLane(items: ItemRecord[]): Record<Lane, number> {
  const counts = Object.fromEntries(
    LANES.map((lane) => [lane.key, 0]),
  ) as Record<Lane, number>;
  for (const item of openItems(items)) {
    if (item.kind === 'capture') {
      continue;
    }
    counts[item.lane] += 1;
  }
  return counts;
}

export function itemMeta(
  item: ItemRecord,
  currentDate: string,
  attachments: AttachmentRecord[],
): string[] {
  if (item.kind === 'capture') {
    const parts = ['Capture', niceDate(item.sourceDate)];
    if (item.syncState === 'conflict') {
      parts.unshift('Needs attention');
    }

    if (item.body.trim()) {
      parts.push('Details');
    }

    const imageCount = attachments.filter(
      (attachment) => attachment.kind === 'image',
    ).length;
    const fileCount = attachments.filter(
      (attachment) => attachment.kind !== 'image',
    ).length;

    if (imageCount) {
      parts.push(imageCount === 1 ? '1 photo' : `${imageCount} photos`);
    }

    if (fileCount) {
      parts.push(fileCount === 1 ? '1 file' : `${fileCount} files`);
    }

    return parts;
  }

  const status =
    item.status === 'upcoming'
      ? item.scheduledDate
        ? 'Scheduled'
        : 'Undated'
      : (ITEM_STATUS_LABELS[item.status] ?? item.status);

  const parts = [status, niceDate(item.sourceDate)];
  if (item.syncState === 'conflict') {
    parts.unshift('Needs attention');
  }
  if (item.scheduledDate) {
    if (item.status === 'upcoming' && item.scheduledDate < currentDate) {
      parts.push('Overdue');
    } else if (
      item.status === 'upcoming' &&
      item.scheduledDate === currentDate
    ) {
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

  const imageCount = attachments.filter(
    (attachment) => attachment.kind === 'image',
  ).length;
  const fileCount = attachments.filter(
    (attachment) => attachment.kind !== 'image',
  ).length;

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
