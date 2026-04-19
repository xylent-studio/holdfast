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
): Array<{ title: string; scheduledDate: DateKey }> {
  const existing = new Set(
    existingItems
      .filter((item) => !item.deletedAt && !['done', 'archived'].includes(item.status))
      .map((item) => normalizeTitle(item.title)),
  );

  return parseLines(closeCarry)
    .filter((line) => !existing.has(normalizeTitle(line)))
    .map((title) => ({ title, scheduledDate: nextDate }));
}
