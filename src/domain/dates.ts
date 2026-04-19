export type DateKey = `${number}-${number}-${number}`;

function atLocalMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

export function formatDateKey(date: Date): DateKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as DateKey;
}

export function todayDateKey(): DateKey {
  return formatDateKey(new Date());
}

export function addDays(dateKey: string, amount: number): DateKey {
  const next = atLocalMidnight(dateKey);
  next.setDate(next.getDate() + amount);
  return formatDateKey(next);
}

export function weekdayIndex(dateKey: string): number {
  return atLocalMidnight(dateKey).getDay();
}

export function startOfWeek(dateKey: string): DateKey {
  const date = atLocalMidnight(dateKey);
  const weekday = date.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + offset);
  return formatDateKey(date);
}

export function endOfWeek(dateKey: string): DateKey {
  return addDays(startOfWeek(dateKey), 6);
}

export function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function inWindow(targetDate: string | null, baseDate: string, span: 'day' | 'week' | 'month'): boolean {
  if (!targetDate) {
    return false;
  }

  if (span === 'day') {
    return targetDate === baseDate;
  }

  if (span === 'week') {
    return targetDate >= startOfWeek(baseDate) && targetDate <= endOfWeek(baseDate);
  }

  return monthKey(targetDate) === monthKey(baseDate);
}

export function niceDate(dateKey: string): string {
  return atLocalMidnight(dateKey).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function niceDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function niceTime(value: string | null): string {
  if (!value) {
    return '';
  }

  const [hourText, minuteText] = value.split(':');
  const date = new Date();
  date.setHours(Number(hourText || 0), Number(minuteText || 0), 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function resolveQuickDate(
  mode: 'tomorrow' | 'thisweek' | 'nextweek' | 'date' | 'someday',
  currentDate: DateKey,
  chosenDate: DateKey,
): DateKey | null {
  switch (mode) {
    case 'tomorrow':
      return addDays(currentDate, 1);
    case 'thisweek':
      return endOfWeek(currentDate);
    case 'nextweek':
      return addDays(endOfWeek(currentDate), 1);
    case 'date':
      return chosenDate;
    case 'someday':
      return null;
  }
}
