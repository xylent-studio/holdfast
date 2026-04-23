import type { ListRecord, ListKind } from '@/domain/schemas/records';

export interface ListTargetGroups {
  current: ListRecord[];
  suggested: ListRecord[];
  recent: ListRecord[];
  pinned: ListRecord[];
  search: ListRecord[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueActiveLists(lists: ListRecord[]): ListRecord[] {
  return lists.filter((list) => !list.deletedAt && !list.archivedAt);
}

function titleMatchScore(list: ListRecord, draftText: string): number {
  const haystack = normalize(draftText);
  const listTitle = normalize(list.title);
  if (!haystack || !listTitle || listTitle.length < 3) {
    return 0;
  }

  if (haystack === listTitle) {
    return 6;
  }

  if (haystack.includes(listTitle)) {
    return 5;
  }

  const listTokens = listTitle.split(/\s+/g).filter((token) => token.length >= 3);
  if (!listTokens.length) {
    return 0;
  }

  const haystackTokens = new Set(haystack.split(/\s+/g));
  const matchedCount = listTokens.filter((token) => haystackTokens.has(token)).length;

  if (matchedCount === listTokens.length) {
    return 4;
  }

  return matchedCount >= 2 ? 3 : 0;
}

function compareByRecency(left: ListRecord, right: ListRecord): number {
  return right.updatedAt.localeCompare(left.updatedAt);
}

export function searchLists(lists: ListRecord[], query: string): ListRecord[] {
  const needle = normalize(query);
  if (!needle) {
    return [];
  }

  return uniqueActiveLists(lists)
    .filter((list) =>
      normalize([list.title, list.kind].join(' | ')).includes(needle),
    )
    .sort(compareByRecency);
}

export function buildListTargetGroups(
  lists: ListRecord[],
  options?: {
    currentListId?: string | null;
    draftText?: string;
    search?: string;
    recentLimit?: number;
  },
): ListTargetGroups {
  const activeLists = uniqueActiveLists(lists);
  const current =
    options?.currentListId
      ? activeLists.filter((list) => list.id === options.currentListId)
      : [];
  const excludedIds = new Set(current.map((list) => list.id));

  const suggested = activeLists
    .map((list) => ({
      list,
      score: titleMatchScore(list, options?.draftText ?? ''),
    }))
    .filter(({ list, score }) => !excludedIds.has(list.id) && score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return compareByRecency(left.list, right.list);
    })
    .map(({ list }) => list)
    .slice(0, 4);

  for (const list of suggested) {
    excludedIds.add(list.id);
  }

  const recent = activeLists
    .filter((list) => !excludedIds.has(list.id))
    .sort(compareByRecency)
    .slice(0, options?.recentLimit ?? 4);

  for (const list of recent) {
    excludedIds.add(list.id);
  }

  const pinned = activeLists
    .filter((list) => !excludedIds.has(list.id) && list.pinned)
    .sort(compareByRecency);

  const search = searchLists(activeLists, options?.search ?? '').filter(
    (list) => !current.some((entry) => entry.id === list.id),
  );

  return {
    current,
    suggested,
    recent,
    pinned,
    search,
  };
}

export function inferListKind(title: string): ListKind {
  const value = normalize(title);

  if (
    /(grocer|grocery|shopping|pantry|market|costco|target run|restock)/.test(
      value,
    )
  ) {
    return 'replenishment';
  }

  if (/(checklist|packing list|pack list|travel checklist|trip checklist)/.test(value)) {
    return 'checklist';
  }

  return 'project';
}
