'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney, formatMonthName } from '@/lib/format';
import { addMonths, currentMonth } from '@/lib/finance/period';
import { generateMonthlyReport } from '@/app/(app)/reports/actions';
import type { MonthlyReport } from '@/lib/types/database';

export function ReportsView({ reports }: { reports: MonthlyReport[] }) {
  const { t, lang, currency } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Offer the last twelve months; a month that has not happened has no report.
  const options = Array.from({ length: 12 }, (_, index) => addMonths(currentMonth(), -index));
  const [selected, setSelected] = useState(`${options[0]!.year}-${options[0]!.month}`);

  const money = (value: number) => formatMoney(value, currency, lang);

  const generate = () => {
    const [year, month] = selected.split('-').map(Number);
    startTransition(async () => {
      const result = await generateMonthlyReport(year!, month!);
      if (result.ok) {
        toast.success(t(result.message ?? 'reports.generated'));
        router.refresh();
      } else {
        toast.error(t(result.error ?? 'common.somethingWrong'));
      }
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('reports.title')} description={t('reports.subtitle')} />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-auto min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={`${option.year}-${option.month}`} value={`${option.year}-${option.month}`}>
                {formatMonthName(option.year, option.month, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={generate} disabled={pending}>
          <RefreshCw className={cn('size-4', pending && 'animate-spin')} aria-hidden />
          {t('reports.generate')}
        </Button>
      </div>

      {reports.length === 0 ? (
        <EmptyState icon={FileText} title={t('reports.empty')} description={t('reports.emptyHint')} />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const delta = report.data?.expense_delta_pct ?? null;
            const highlight =
              delta === null
                ? null
                : delta < -1
                  ? t('reports.betterThanLast', { percent: Math.abs(Math.round(delta)) })
                  : delta > 1
                    ? t('reports.worseThanLast', { percent: Math.round(delta) })
                    : t('reports.sameAsLast');

            return (
              <Card key={report.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold">
                      {formatMonthName(report.year, report.month, lang)}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {t('reports.transactions', { count: report.data?.transaction_count ?? 0 })}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Figure label={t('reports.income')} value={money(Number(report.income))} tone="text-success" />
                    <Figure label={t('reports.expenses')} value={money(Number(report.expenses))} tone="text-danger" />
                    <Figure
                      label={t('reports.savings')}
                      value={money(Number(report.savings))}
                      tone={Number(report.savings) >= 0 ? 'text-foreground' : 'text-danger'}
                    />
                    <Figure
                      label={t('reports.savingsRate')}
                      value={`${Math.round(Number(report.savings_rate))}%`}
                    />
                  </dl>

                  {report.data?.top_category ? (
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{t('reports.topCategory')}</span>
                        <span className="mf-tabular font-medium">
                          {report.data.top_category.name} · {money(report.data.top_category.amount)}
                        </span>
                      </div>
                      <Progress
                        value={
                          Number(report.expenses) > 0
                            ? (report.data.top_category.amount / Number(report.expenses)) * 100
                            : 0
                        }
                        className="h-1.5"
                        indicatorStyle={{ backgroundColor: report.data.top_category.color }}
                      />
                    </div>
                  ) : null}

                  {highlight ? (
                    <p
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                        delta !== null && delta < -1
                          ? 'bg-success/10 text-success'
                          : delta !== null && delta > 1
                            ? 'bg-warning/10 text-warning'
                            : 'bg-accent text-muted-foreground',
                      )}
                    >
                      {delta !== null && delta < -1 ? (
                        <TrendingDown className="size-4 shrink-0" aria-hidden />
                      ) : (
                        <TrendingUp className="size-4 shrink-0" aria-hidden />
                      )}
                      {highlight}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mf-tabular truncate text-lg font-semibold', tone)}>{value}</dd>
    </div>
  );
}
