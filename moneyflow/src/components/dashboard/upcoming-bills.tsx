'use client';

import Link from 'next/link';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';
import type { UpcomingBill } from '@/lib/data/snapshot';

export function UpcomingBills({ bills }: { bills: UpcomingBill[] }) {
  const { t, lang, currency } = useI18n();
  if (bills.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('dashboard.upcomingBills')}</CardTitle>
        <Link
          href="/recurring"
          className="flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('dashboard.viewAll')}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </CardHeader>

      <CardContent className="space-y-2">
        {bills.slice(0, 4).map((bill) => (
          <div key={bill.id} className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
              <CalendarClock className="size-4" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{bill.name}</p>
              <p className="text-xs text-muted-foreground">
                {bill.daysUntil <= 0
                  ? t('recurring.dueToday')
                  : t('recurring.dueIn', { days: bill.daysUntil })}
              </p>
            </div>

            <Badge variant={bill.daysUntil <= 1 ? 'warning' : 'muted'} className="mf-tabular shrink-0">
              {formatMoney(bill.amount, currency, lang)}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
