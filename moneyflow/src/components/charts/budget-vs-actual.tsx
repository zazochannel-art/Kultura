'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartShell, ChartTooltip, LegendItem } from './chart-shell';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';

export interface BudgetPoint {
  name: string;
  planned: number;
  actual: number;
}

export function BudgetVsActual({ data }: { data: BudgetPoint[] }) {
  const { t, lang, currency } = useI18n();

  return (
    <ChartShell
      title={t('analytics.budgetVsActual')}
      legend={
        <>
          <LegendItem color="var(--chart-1)" label={t('budgets.totalPlanned')} />
          <LegendItem color="var(--chart-2)" label={t('budgets.totalSpent')} />
        </>
      }
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            barGap={2}
          >
            <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
              tickFormatter={(value: number) =>
                formatMoney(value, currency, lang, { compact: value >= 10000 })
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={86}
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    label={String(label)}
                    rows={[
                      {
                        color: 'var(--chart-1)',
                        name: t('budgets.totalPlanned'),
                        value: formatMoney(Number(payload[0]?.value ?? 0), currency, lang),
                      },
                      {
                        color: 'var(--chart-2)',
                        name: t('budgets.totalSpent'),
                        value: formatMoney(Number(payload[1]?.value ?? 0), currency, lang),
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="planned" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={12} />
            <Bar dataKey="actual" fill="var(--chart-2)" radius={[0, 4, 4, 0]} maxBarSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
