/** Calendar helpers. Everything the app calls "this month" comes from here. */

export interface MonthRef {
  year: number;
  month: number; // 1-12
}

export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function currentMonth(now: Date = new Date()): MonthRef {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function monthStart({ year, month }: MonthRef): Date {
  return new Date(year, month - 1, 1);
}

export function monthEnd({ year, month }: MonthRef): Date {
  return new Date(year, month, 0);
}

export function daysInMonth({ year, month }: MonthRef): number {
  return new Date(year, month, 0).getDate();
}

/** Days left in the month counting today, so it is never zero. */
export function remainingDaysInMonth(now: Date = new Date()): number {
  const total = daysInMonth(currentMonth(now));
  return Math.max(1, total - now.getDate() + 1);
}

export function elapsedDaysInMonth(now: Date = new Date()): number {
  return now.getDate();
}

export function addMonths(ref: MonthRef, delta: number): MonthRef {
  const base = new Date(ref.year, ref.month - 1 + delta, 1);
  return { year: base.getFullYear(), month: base.getMonth() + 1 };
}

export function monthRange(ref: MonthRef): { from: string; to: string } {
  return { from: toDateOnly(monthStart(ref)), to: toDateOnly(monthEnd(ref)) };
}

export function daysBetween(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const left = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const right = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((right - left) / ms);
}

/** Next occurrence strictly after `from`, mirroring `mf_advance_date` in SQL. */
export function advanceDate(from: Date, frequency: string): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

/**
 * Every time a recurring entry falls due between `from` and `to` (inclusive).
 * Capped so a daily entry over a long window cannot run away.
 */
export function occurrencesBetween(
  nextDate: Date,
  frequency: string,
  from: Date,
  to: Date,
  cap = 400,
): Date[] {
  const out: Date[] = [];
  let cursor = new Date(nextDate);
  let guard = 0;

  while (cursor <= to && guard < cap) {
    if (cursor >= from) out.push(new Date(cursor));
    cursor = advanceDate(cursor, frequency);
    guard += 1;
  }
  return out;
}

/** Days until the next payday, given the day-of-month the user gets paid. */
export function daysUntilPayday(paydayDay: number, now: Date = new Date()): number {
  const day = Math.min(Math.max(paydayDay, 1), 31);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayThis = daysInMonth({ year: thisMonth.getFullYear(), month: thisMonth.getMonth() + 1 });
  const candidate = new Date(now.getFullYear(), now.getMonth(), Math.min(day, lastDayThis));

  if (candidate >= startOfDay(now)) return daysBetween(now, candidate);

  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastDayNext = daysInMonth({ year: next.getFullYear(), month: next.getMonth() + 1 });
  return daysBetween(now, new Date(next.getFullYear(), next.getMonth(), Math.min(day, lastDayNext)));
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
