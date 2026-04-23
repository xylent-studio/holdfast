import type { DateKey } from '@/domain/dates';
import type { ItemRecord } from '@/domain/schemas/records';

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildCarryForwardTasks(
  closeCarry: string,
  nextDate: DateKey,
  existingItems: ItemRecord[],
): Array<{
  title: string;
  scheduledDate: DateKey;
  existingItemId: string | null;
}> {
  const existing = existingItems.filter(
    (item) =>
      !item.deletedAt &&
      item.kind !== 'capture' &&
      !['done', 'archived'].includes(item.status),
  );
  const consumed = new Set<string>();

  return parseLines(closeCarry).map((title) => {
    const normalized = normalizeTitle(title);
    const matchedItem =
      existing.find(
        (item) =>
          !consumed.has(item.id) && normalizeTitle(item.title) === normalized,
      ) ?? null;

    if (matchedItem) {
      consumed.add(matchedItem.id);
    }

    return {
      title,
      scheduledDate: nextDate,
      existingItemId: matchedItem?.id ?? null,
    };
  });
}
