'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { IconBadge } from '@/components/shared/icon-badge';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';
import type { BudgetLine } from '@/lib/data/snapshot';

const BAR_TONE = {
  safe: 'bg-success',
  near_limit: 'bg-warning',
  over: 'bg-danger',
} as const;

export function BudgetsOverview({ lines }: { lines: BudgetLine[] }) {
  const { t, lang, currency } = useI18n();
  if (lines.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('dashboard.budgetsOverview')}</CardTitle>
        <Link
          href="/budgets"
          className="flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('dashboard.viewAll')}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        {lines.slice(0, 4).map((line) => (
          <div key={line.category.id} className="flex items-center gap-3">
            <IconBadge icon={line.category.icon} color={line.category.color} size="sm" />

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{line.category.name}</p>
                <p className="mf-tabular shrink-0 text-xs text-muted-foreground">
                  {formatMoney(line.spent, currency, lang)} / {formatMoney(line.planned, currency, lang)}
                </p>
              </div>
              <Progress
                value={line.ratio * 100}
                className="h-1.5"
                indicatorClassName={BAR_TONE[line.status]}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
