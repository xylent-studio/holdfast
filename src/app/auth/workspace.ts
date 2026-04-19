import type { HoldfastSnapshot } from '@/storage/local/api';

function hasText(value: string): boolean {
  return Boolean(value.trim());
}

export function hasMeaningfulLocalState(snapshot: HoldfastSnapshot): boolean {
  if (
    snapshot.items.length ||
    snapshot.lists.length ||
    snapshot.listItems.length ||
    snapshot.routines.length
  ) {
    return true;
  }

  if (
    hasText(snapshot.settings.direction) ||
    hasText(snapshot.settings.standards) ||
    hasText(snapshot.settings.why)
  ) {
    return true;
  }

  if (
    hasText(snapshot.weeklyRecord.focus) ||
    hasText(snapshot.weeklyRecord.protect) ||
    hasText(snapshot.weeklyRecord.notes)
  ) {
    return true;
  }

  return snapshot.dailyRecords.some(
    (record) =>
      Boolean(record.startedAt) ||
      Boolean(record.closedAt) ||
      record.focusItemIds.length > 0 ||
      hasText(record.launchNote) ||
      hasText(record.closeWin) ||
      hasText(record.closeCarry) ||
      hasText(record.closeSeed) ||
      hasText(record.closeNote),
  );
}
