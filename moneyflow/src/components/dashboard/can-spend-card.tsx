'use client';

import { useState } from 'react';
import { ChevronDown, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';
import type { DailyBudgetResult } from '@/lib/finance/daily-budget';

const STATUS_TONE = {
  on_track: { text: 'text-success', dot: 'bg-success', bar: 'bg-success' },
  near_limit: { text: 'text-warning', dot: 'bg-warning', bar: 'bg-warning' },
  over: { text: 'text-danger', dot: 'bg-danger', bar: 'bg-danger' },
  negative: { text: 'text-danger', dot: 'bg-danger', bar: 'bg-danger' },
} as const;

/**
 * The card the whole product is built around. Everything else on the dashboard
 * is supporting evidence for this number, so it gets the space, the glow, and
 * the breakdown that shows its working.
 */
export function CanSpendCard({ budget }: { budget: DailyBudgetResult }) {
  const { t, lang, currency } = useI18n();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const money = (value: number) => formatMoney(value, currency, lang);

  const tone = STATUS_TONE[budget.status];

  const statusLine =
    budget.status === 'negative'
      ? t('dashboard.negative', { amount: money(Math.abs(budget.availableMoney)) })
      : budget.status === 'over'
        ? t('dashboard.over', { amount: money(budget.overBy) })
        : budget.status === 'near_limit'
          ? t('dashboard.nearLimit')
          : t('dashboard.onTrack');

  const rows = [
    { label: t('dashboard.breakdown.balance'), value: budget.breakdown.currentBalance, sign: 1 },
    { label: t('dashboard.breakdown.upcoming'), value: budget.breakdown.upcomingIncome, sign: 1 },
    { label: t('dashboard.breakdown.reserved'), value: budget.breakdown.reservedMoney, sign: -1 },
    { label: t('dashboard.breakdown.fixed'), value: budget.breakdown.remainingFixedExpenses, sign: -1 },
    { label: t('dashboard.breakdown.savings'), value: budget.breakdown.savingsTargetRemaining, sign: -1 },
  ].filter((row) => row.value !== 0);

  return (
    <Card className="mf-glow relative overflow-hidden border-border/80">
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{t('dashboard.canSpendToday')}</p>
            <p className="mf-hero-number animate-count text-[2.75rem] font-semibold sm:text-6xl">
              {money(budget.canSpendToday)}
            </p>
          </div>

          <span
            className={cn(
              'mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl',
              budget.status === 'on_track' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
            )}
            aria-hidden
          >
            {budget.status === 'on_track' ? (
              <TrendingUp className="size-4.5" />
            ) : (
              <TrendingDown className="size-4.5" />
            )}
          </span>
        </div>

        <p className={cn('mt-3 flex items-center gap-2 text-sm font-medium', tone.text)}>
          <span className={cn('size-2 rounded-full', tone.dot)} aria-hidden />
          {statusLine}
        </p>

        <div className="mt-5 space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{t('dashboard.dailyBudget')}</span>
            <span className="mf-tabular font-medium">{money(budget.dailyBudget)}</span>
          </div>

          <Progress
            value={budget.usedRatio * 100}
            indicatorClassName={tone.bar}
            aria-label={t('dashboard.dailyBudget')}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('dashboard.spentToday', { amount: money(budget.spentToday) })}</span>
            <span>{t('dashboard.daysLeft', { days: budget.remainingDays })}</span>
          </div>
        </div>

        {budget.limitedByBudget ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden />
            {t('dashboard.limitedByBudget')}
          </p>
        ) : null}

        <Separator className="my-4" />

        <button
          type="button"
          onClick={() => setShowBreakdown((value) => !value)}
          aria-expanded={showBreakdown}
          className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('dashboard.breakdown')}
          <ChevronDown
            className={cn('size-4 transition-transform', showBreakdown && 'rotate-180')}
            aria-hidden
          />
        </button>

        {showBreakdown ? (
          <dl className="mt-3 space-y-1.5 animate-fade text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <dt className="truncate text-muted-foreground">{row.label}</dt>
                <dd className={cn('mf-tabular shrink-0', row.sign < 0 && 'text-danger')}>
                  {row.sign < 0 ? '−' : ''}
                  {money(row.value)}
                </dd>
              </div>
            ))}
            <Separator className="!my-2" />
            <div className="flex items-center justify-between gap-4 font-medium">
              <dt className="truncate">{t('dashboard.breakdown.available')}</dt>
              <dd className="mf-tabular shrink-0">{money(budget.availableMoney)}</dd>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              {money(budget.availableMoney)} ÷ {budget.remainingDays} {t('common.days')} ={' '}
              {money(budget.breakdown.cashFlowDaily)}
            </p>
          </dl>
        ) : null}
      </div>
    </Card>
  );
}
