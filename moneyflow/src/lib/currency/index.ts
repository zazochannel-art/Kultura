/**
 * Exchange rates behind a provider interface.
 *
 * Accounts can be held in different currencies while the profile reports in
 * one, so the totals need a conversion somewhere. Which service supplies it is
 * a deployment decision, not an application one — swap the provider here and
 * nothing else in the app changes.
 */

import type { CurrencyCode } from '@/lib/types/database';

export interface RateTable {
  base: CurrencyCode;
  /** Units of `base` per one unit of the keyed currency. */
  rates: Record<CurrencyCode, number>;
  fetchedAt: string;
  provider: string;
}

export interface ExchangeRateProvider {
  readonly name: string;
  getRates(base: CurrencyCode): Promise<RateTable>;
}

/**
 * Offline fallback. Deliberately approximate and clearly labelled: it exists so
 * a multi-currency total is never blank, not so anyone trades on it.
 */
const STATIC_RATES: Record<CurrencyCode, Record<CurrencyCode, number>> = {
  MDL: { MDL: 1, EUR: 19.5, USD: 17.9, RON: 3.9 },
  EUR: { MDL: 0.0513, EUR: 1, USD: 0.918, RON: 0.2 },
  USD: { MDL: 0.0559, EUR: 1.089, USD: 1, RON: 0.218 },
  RON: { MDL: 0.2564, EUR: 5.0, USD: 4.59, RON: 1 },
};

export const staticProvider: ExchangeRateProvider = {
  name: 'static',
  async getRates(base) {
    return {
      base,
      rates: STATIC_RATES[base] ?? STATIC_RATES.MDL,
      fetchedAt: new Date().toISOString(),
      provider: 'static',
    };
  },
};

/** frankfurter.app — free, keyless, ECB-derived. */
export const frankfurterProvider: ExchangeRateProvider = {
  name: 'frankfurter',
  async getRates(base) {
    const symbols = (['MDL', 'EUR', 'USD', 'RON'] as CurrencyCode[]).filter((c) => c !== base);
    const url = `https://api.frankfurter.app/latest?from=${base}&to=${symbols.join(',')}`;

    const response = await fetch(url, { next: { revalidate: 60 * 60 * 6 } });
    if (!response.ok) throw new Error(`frankfurter responded ${response.status}`);

    const payload = (await response.json()) as { rates?: Record<string, number> };
    const rates: Record<CurrencyCode, number> = { ...STATIC_RATES[base] };
    rates[base] = 1;

    for (const code of symbols) {
      const perBase = payload.rates?.[code];
      // The API gives "how much CODE per 1 BASE"; the table wants the inverse.
      if (perBase && perBase > 0) rates[code] = 1 / perBase;
    }

    return { base, rates, fetchedAt: new Date().toISOString(), provider: 'frankfurter' };
  },
};

export function getProvider(): ExchangeRateProvider {
  return process.env.EXCHANGE_RATES_PROVIDER === 'static' ? staticProvider : frankfurterProvider;
}

/** Never fails a page render over an exchange rate; falls back to the static table. */
export async function getRates(base: CurrencyCode): Promise<RateTable> {
  try {
    return await getProvider().getRates(base);
  } catch {
    return staticProvider.getRates(base);
  }
}

export function convert(amount: number, from: CurrencyCode, table: RateTable): number {
  if (from === table.base) return amount;
  const rate = table.rates[from];
  return Number.isFinite(rate) && rate > 0 ? amount * rate : amount;
}
