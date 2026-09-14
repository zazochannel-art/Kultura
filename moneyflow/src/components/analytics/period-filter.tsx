'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

export const PERIODS = ['7d', '30d', '3m', '6m', '1y'] as const;
export type Period = (typeof PERIODS)[number];

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}

/** One row of range controls above the charts, as a segmented control. */
export function PeriodFilter({ value }: { value: Period }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();

  return (
    <div className="mf-scroll-x flex gap-1 rounded-xl bg-accent/60 p-1" role="tablist">
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          role="tab"
          aria-selected={value === period}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set('period', period);
            router.replace(`/analytics?${next.toString()}`, { scroll: false });
          }}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
            value === period
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t(`analytics.period.${period}` as TranslationKey)}
        </button>
      ))}
    </div>
  );
}
