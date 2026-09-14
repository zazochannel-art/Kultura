import type { CurrencyCode } from '@/lib/types/database';
import { localeTag } from '@/lib/i18n';
import type { LanguageCode } from '@/lib/types/database';

export const CURRENCIES: CurrencyCode[] = ['MDL', 'EUR', 'USD', 'RON'];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  MDL: 'L',
  EUR: '€',
  USD: '$',
  RON: 'lei',
};

/**
 * Money, the way the app shows it everywhere: no decimals when the amount is
 * whole, because "185 MDL" reads faster than "185,00 MDL" on a card whose whole
 * job is to be read at a glance.
 */
export function formatMoney(
  amount: number,
  currency: CurrencyCode = 'MDL',
  lang: LanguageCode = 'ro',
  options: { decimals?: boolean; sign?: boolean; compact?: boolean } = {},
): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const showDecimals = options.decimals ?? !Number.isInteger(value);

  const formatted = new Intl.NumberFormat(localeTag(lang), {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
    notation: options.compact ? 'compact' : 'standard',
  }).format(Math.abs(value));

  const prefix = options.sign && value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${formatted} ${CURRENCY_SYMBOLS[currency] ?? currency}`;
}

export function formatNumber(value: number, lang: LanguageCode = 'ro', decimals = 0): string {
  return new Intl.NumberFormat(localeTag(lang), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(ratio: number, lang: LanguageCode = 'ro', decimals = 0): string {
  return new Intl.NumberFormat(localeTag(lang), {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(ratio) ? ratio : 0);
}

export function formatDate(
  value: string | Date,
  lang: LanguageCode = 'ro',
  style: 'short' | 'medium' | 'long' | 'month' = 'medium',
): string {
  const date = typeof value === 'string' ? parseISODate(value) : value;
  if (!date) return '—';

  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : style === 'month'
          ? { month: 'long', year: 'numeric' }
          : { day: 'numeric', month: 'short', year: 'numeric' };

  return new Intl.DateTimeFormat(localeTag(lang), options).format(date);
}

export function formatMonthName(
  year: number,
  month: number,
  lang: LanguageCode = 'ro',
): string {
  return new Intl.DateTimeFormat(localeTag(lang), { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}

/** "Azi" / "Ieri" / a date, using the caller's already-translated labels. */
export function formatRelativeDay(
  value: string | Date,
  lang: LanguageCode,
  labels: { today: string; yesterday: string },
): string {
  const date = typeof value === 'string' ? parseISODate(value) : value;
  if (!date) return '—';

  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86_400_000);

  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  return formatDate(date, lang, 'short');
}

/** Date-only strings are parsed as local dates; `new Date('2026-01-05')` is UTC. */
export function parseISODate(value: string): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Accepts "1.234,56", "1,234.56" and "1234.56" — people type all three. */
export function parseAmount(input: string): number {
  const raw = input.trim().replace(/\s/g, '');
  if (!raw) return NaN;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');

  let normalized: string;
  if (lastComma > lastDot) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    normalized = raw.replace(/,/g, '');
  } else {
    normalized = raw;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

export function initials(name: string | null | undefined, fallback = 'MF'): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || fallback;
}
