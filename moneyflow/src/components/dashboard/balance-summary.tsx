'use client';

import { ArrowDownRight, ArrowUpRight, PiggyBank } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';

export function BalanceSummary({
  total,
  income,
  expenses,
  savings,
}: {
  total: number;
  income: number;
  expenses: number;
  savings: number;
}) {
  const { t, lang, currency } = useI18n();
  const money = (value: number, sign = false) => formatMoney(value, currency, lang, { sign });

  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{t('dashboard.totalBalance')}</p>
      <p className="mf-hero-number mt-1 text-3xl font-semibold sm:text-4xl">{money(total)}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <Stat
          icon={<ArrowUpRight className="size-3.5" aria-hidden />}
          tone="text-success"
          value={money(income, true)}
          label={t('dashboard.income')}
        />
        <Stat
          icon={<ArrowDownRight className="size-3.5" aria-hidden />}
          tone="text-danger"
          value={`−${formatMoney(expenses, currency, lang)}`}
          label={t('dashboard.expenses')}
        />
        <Stat
          icon={<PiggyBank className="size-3.5" aria-hidden />}
          tone="text-primary"
          value={money(savings, true)}
          label={t('dashboard.savings')}
        />
      </div>
    </Card>
  );
}

function Stat({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p className={`mf-tabular flex items-center gap-1 truncate font-medium ${tone}`}>
        {icon}
        <span className="truncate">{value}</span>
      </p>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
