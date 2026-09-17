import { DEFAULT_CURRENCY } from "./constants";

/**
 * Formatări — toate cu locale `ro-RO`.
 *
 * Moneda nu este hardcodată: componentele o primesc din setări
 * (`useCurrency()`), iar aceste funcții acceptă codul ca argument.
 */

export function formatMoney(
  value: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  options: { compact?: boolean; decimals?: boolean } = {},
): string {
  const amount = Number(value) || 0;
  const formatter = new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: options.decimals ? 2 : 0,
    maximumFractionDigits: options.decimals ? 2 : 0,
    // „17 K MDL” se citește greu pe șantier; prescurtăm abia de la un milion.
    notation:
      options.compact && Math.abs(amount) >= 1_000_000 ? "compact" : "standard",
  });
  return `${formatter.format(amount)} ${currency}`;
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 2,
): string {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
}

const MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

const WEEKDAYS = [
  "duminică",
  "luni",
  "marți",
  "miercuri",
  "joi",
  "vineri",
  "sâmbătă",
];

export const WEEKDAY_SHORT = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];

export function monthName(monthIndex: number): string {
  return MONTHS[((monthIndex % 12) + 12) % 12];
}

export function weekdayName(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

/** `2026-09-17` — cheia folosită peste tot pentru zile. */
export function toDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = value.length <= 10 ? parseDateKey(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getDate()} ${monthName(date.getMonth())} ${date.getFullYear()}`;
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  const date = value.length <= 10 ? parseDateKey(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDateShort(toDateKey(date))}, ${formatTime(date)}`;
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** „acum 3 zile”, „mâine”, „azi”. */
export function relativeDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = value.length <= 10 ? parseDateKey(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Math.round(
    (parseDateKey(toDateKey(date)).getTime() -
      parseDateKey(todayKey()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return "Azi";
  if (diff === 1) return "Mâine";
  if (diff === -1) return "Ieri";
  if (diff > 1 && diff < 7) return `În ${diff} zile`;
  if (diff < -1 && diff > -7) return `Acum ${Math.abs(diff)} zile`;
  return null;
}

/** 455 → „7h 35m”. */
export function formatDuration(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Cronometru live: „01:24:09”. */
export function formatStopwatch(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function formatQuoteNumber(n: number): string {
  return `#${String(n).padStart(5, "0")}`;
}

export function formatPercent(value: number | null | undefined): string {
  return `${formatNumber(value ?? 0, 1)}%`;
}
