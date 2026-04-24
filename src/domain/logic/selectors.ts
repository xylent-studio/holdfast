import { ITEM_STATUS_LABELS, LANES } from '@/domain/constants';
import {
  addDays,
  endOfWeek,
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

export type InboxFilter = 'unsorted' | 'archived';
export type UpcomingFilter = 'scheduled' | 'undated' | 'waiting';
export type ReviewableItem = ItemRecord & {
  attachments?: AttachmentRecord[];
};
export type ReviewMatchReason =
  | { field: 'title'; value?: string }
  | { field: 'notes'; value?: string }
  | { field: 'source'; value?: string }
  | { field: 'attachment'; value?: string }
  | { field: 'status'; value?: string }
  | { field: 'listTitle'; value?: string }
  | { field: 'dayNote'; value?: string };
export type ReviewSearchResult<T extends ItemRecord = ItemRecord> =
  | { type: 'item'; item: T; matchedOn: ReviewMatchReason[]; score: number }
  | {
      type: 'day';
      date: string;
      dailyRecord: DailyRecord;
      matchedOn: ReviewMatchReason[];
      score: number;
    }
  | {
      type: 'list';
      list: ListRecord;
      openCount: number;
      doneCount: number;
      matchedOn: ReviewMatchReason[];
      score: number;
    }
  | {
      type: 'listItem';
      list: ListRecord;
      listItem: ListItemRecord;
      matchedOn: ReviewMatchReason[];
      score: number;
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

export function focusedListsForDay<T extends ListRecord>(
  day: DailyRecord,
  lists: T[],
): T[] {
  return (day.focusListIds ?? [])
    .map((id) => lists.find((list) => list.id === id))
    .filter((list): list is T => Boolean(list && !list.deletedAt && !list.archivedAt));
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

export function listItemsForNow<T extends ListItemRecord>(
  listItems: T[],
  currentDate: string,
): T[] {
  return listItems
    .filter(
      (item) =>
        !item.deletedAt &&
        item.status === 'open' &&
        item.nowDate === currentDate,
    )
    .sort((left, right) => left.position - right.position);
}

export function listsForNow<T extends ListRecord>(
  lists: T[],
  currentDate: string,
): T[] {
  return lists
    .filter(
      (list) =>
        !list.deletedAt &&
        !list.archivedAt &&
        list.scheduledDate === currentDate,
    )
    .sort((left, right) =>
      `${left.scheduledDate ?? ''}${left.scheduledTime ?? ''}${left.updatedAt}`.localeCompare(
        `${right.scheduledDate ?? ''}${right.scheduledTime ?? ''}${right.updatedAt}`,
      ),
    );
}

export function overdueLists<T extends ListRecord>(
  lists: T[],
  currentDate: string,
): T[] {
  return lists
    .filter(
      (list) =>
        !list.deletedAt &&
        !list.archivedAt &&
        Boolean(list.scheduledDate) &&
        list.scheduledDate < currentDate,
    )
    .sort((left, right) =>
      `${left.scheduledDate ?? ''}${left.scheduledTime ?? ''}${left.updatedAt}`.localeCompare(
        `${right.scheduledDate ?? ''}${right.scheduledTime ?? ''}${right.updatedAt}`,
      ),
    );
}

export function scheduledLists<T extends ListRecord>(
  lists: T[],
  currentDate: string,
): T[] {
  return lists
    .filter(
      (list) =>
        !list.deletedAt &&
        !list.archivedAt &&
        Boolean(list.scheduledDate) &&
        list.scheduledDate > currentDate,
    )
    .sort((left, right) =>
      `${left.scheduledDate ?? ''}${left.scheduledTime ?? ''}${left.updatedAt}`.localeCompare(
        `${right.scheduledDate ?? ''}${right.scheduledTime ?? ''}${right.updatedAt}`,
      ),
    );
}

export function activeListItemsForDisplay<T extends ListItemRecord>(
  listItems: T[],
  listId: string,
): T[] {
  return listItems
    .filter(
      (item) =>
        item.listId === listId &&
        !item.deletedAt &&
        item.status !== 'archived',
    )
    .sort((left, right) => {
      const leftRank = left.status === 'done' ? 1 : 0;
      const rightRank = right.status === 'done' ? 1 : 0;
      return leftRank - rightRank || left.position - right.position;
    });
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

export function scheduledUpcomingItems<T extends ItemRecord>(
  items: T[],
  currentDate: string,
): T[] {
  return items
    .filter(
      (item) =>
        !item.deletedAt &&
        item.kind !== 'capture' &&
        item.status === 'upcoming' &&
        Boolean(item.scheduledDate) &&
        item.scheduledDate >= currentDate,
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
  function includesNeedle(value: string | null | undefined): boolean {
    return normalizedText(value ?? '').includes(needle);
  }

  function scoreReasons(reasons: ReviewMatchReason[]): number {
    return reasons.reduce((total, reason) => {
      switch (reason.field) {
        case 'title':
          return total + 10;
        case 'listTitle':
          return total + 8;
        case 'notes':
          return total + 6;
        case 'source':
        case 'attachment':
          return total + 5;
        case 'dayNote':
          return total + 4;
        case 'status':
          return total + 3;
      }
    }, 0);
  }

  function uniqueReasons(reasons: ReviewMatchReason[]): ReviewMatchReason[] {
    const seen = new Set<string>();
    return reasons.filter((reason) => {
      const key = `${reason.field}:${reason.value ?? ''}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  const needle = normalizedText(query);
  if (!needle) {
    return [];
  }

  const itemResults = items
    .filter((item) => !item.deletedAt)
    .map((item) => {
      const matchedOn = uniqueReasons([
        ...(includesNeedle(item.title)
          ? [{ field: 'title', value: item.title } satisfies ReviewMatchReason]
          : []),
        ...(includesNeedle(item.body)
          ? [{ field: 'notes', value: item.body } satisfies ReviewMatchReason]
          : []),
        ...(includesNeedle(item.sourceText)
          ? [{ field: 'source', value: item.sourceText ?? '' } satisfies ReviewMatchReason]
          : []),
        ...(item.attachments ?? [])
          .filter((attachment) => includesNeedle(attachment.name))
          .map(
            (attachment) =>
              ({
                field: 'attachment',
                value: attachment.name,
              }) satisfies ReviewMatchReason,
          ),
        ...(includesNeedle(ITEM_STATUS_LABELS[item.status] ?? item.status)
          ? [
              {
                field: 'status',
                value: ITEM_STATUS_LABELS[item.status] ?? item.status,
              } satisfies ReviewMatchReason,
            ]
          : []),
      ]);

      if (!matchedOn.length) {
        return null;
      }

      return {
        type: 'item',
        item,
        matchedOn,
        score: scoreReasons(matchedOn),
      } as const satisfies ReviewSearchResult<T>;
    })
    .filter((result): result is ReviewSearchResult<T> => Boolean(result));

  const dayResults = dailyRecords
    .map((dailyRecord) => {
      const matchedValue = [
        dailyRecord.launchNote,
        dailyRecord.closeWin,
        dailyRecord.closeCarry,
        dailyRecord.closeSeed,
        dailyRecord.closeNote,
      ].find((value) => includesNeedle(value));
      if (!matchedValue) {
        return null;
      }

      const matchedOn = [
        {
          field: 'dayNote',
          value: matchedValue,
        } satisfies ReviewMatchReason,
      ];

      return {
        type: 'day',
        date: dailyRecord.date,
        dailyRecord,
        matchedOn,
        score: scoreReasons(matchedOn),
      } as const satisfies ReviewSearchResult<T>;
    })
    .filter((result): result is ReviewSearchResult<T> => Boolean(result));

  const activeLists = lists.filter((list) => !list.deletedAt);
  const activeListItems = listItems.filter(
    (listItem) => !listItem.deletedAt,
  );
  const itemsByListId = new Map<string, ListItemRecord[]>();
  for (const listItem of activeListItems) {
    const next = itemsByListId.get(listItem.listId) ?? [];
    next.push(listItem);
    itemsByListId.set(listItem.listId, next);
  }

  const listResults = activeLists
    .map((list) => {
      const matchedOn = uniqueReasons([
        ...(includesNeedle(list.title)
          ? [{ field: 'listTitle', value: list.title } satisfies ReviewMatchReason]
          : []),
        ...(includesNeedle(list.kind)
          ? [{ field: 'status', value: list.kind } satisfies ReviewMatchReason]
          : []),
      ]);
      if (!matchedOn.length) {
        return null;
      }

      const relatedItems = itemsByListId.get(list.id) ?? [];
      return {
        type: 'list',
        list,
        openCount: relatedItems.filter((entry) => entry.status === 'open')
          .length,
        doneCount: relatedItems.filter((entry) => entry.status === 'done')
          .length,
        matchedOn,
        score: scoreReasons(matchedOn),
      } as const satisfies ReviewSearchResult<T>;
    })
    .filter((result): result is ReviewSearchResult<T> => Boolean(result));

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
    .map(({ list, listItem }) => {
      const matchedOn = uniqueReasons([
        ...(includesNeedle(listItem.title)
          ? [{ field: 'title', value: listItem.title } satisfies ReviewMatchReason]
          : []),
        ...(includesNeedle(listItem.body)
          ? [{ field: 'notes', value: listItem.body } satisfies ReviewMatchReason]
          : []),
        ...(includesNeedle(list.title)
          ? [{ field: 'listTitle', value: list.title } satisfies ReviewMatchReason]
          : []),
        ...(includesNeedle(listItem.status)
          ? [{ field: 'status', value: listItem.status } satisfies ReviewMatchReason]
          : []),
      ]);
      if (!matchedOn.length) {
        return null;
      }

      return {
        type: 'listItem',
        list,
        listItem,
        matchedOn,
        score: scoreReasons(matchedOn),
      } as const satisfies ReviewSearchResult<T>;
    })
    .filter((result): result is ReviewSearchResult<T> => Boolean(result));

  return [
    ...itemResults,
    ...dayResults,
    ...listResults,
    ...listItemResults,
  ].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
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
