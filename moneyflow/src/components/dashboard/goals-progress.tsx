'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { IconBadge } from '@/components/shared/icon-badge';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';
import type { Goal } from '@/lib/types/database';

export function GoalsProgress({ goals }: { goals: Goal[] }) {
  const { t, lang, currency } = useI18n();
  if (goals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('dashboard.goalsProgress')}</CardTitle>
        <Link
          href="/goals"
          className="flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('dashboard.viewAll')}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        {goals.slice(0, 3).map((goal) => {
          const ratio = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
          return (
            <div key={goal.id} className="flex items-center gap-3">
              <IconBadge icon={goal.icon} color={goal.color} size="sm" />

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{goal.name}</p>
                  <p className="mf-tabular shrink-0 text-xs text-muted-foreground">
                    {Math.round(ratio * 100)}%
                  </p>
                </div>
                <Progress
                  value={ratio * 100}
                  className="h-1.5"
                  indicatorStyle={{ backgroundColor: goal.color }}
                />
                <p className="mf-tabular text-xs text-muted-foreground">
                  {formatMoney(goal.current_amount, currency, lang)} / {formatMoney(goal.target_amount, currency, lang)}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
