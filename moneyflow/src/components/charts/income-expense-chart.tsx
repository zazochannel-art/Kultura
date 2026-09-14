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

export interface MonthPoint {
  label: string;
  income: number;
  expense: number;
}

/**
 * Income against expenses, month by month. One shared y-axis — two money series
 * of the same unit belong on the same scale, and a second axis would invent a
 * relationship the data does not have.
 */
export function IncomeExpenseChart({ data }: { data: MonthPoint[] }) {
  const { t, lang, currency } = useI18n();
  const money = (value: number) => formatMoney(value, currency, lang, { compact: value >= 10000 });

  const totalIncome = data.reduce((sum, point) => sum + point.income, 0);
  const totalExpense = data.reduce((sum, point) => sum + point.expense, 0);

  return (
    <ChartShell
      title={t('analytics.incomeVsExpenses')}
      headline={formatMoney(totalIncome - totalExpense, currency, lang)}
      sub={t('analytics.netFlow')}
      legend={
        <>
          <LegendItem color="var(--chart-income)" label={t('dashboard.income')} />
          <LegendItem color="var(--chart-expense)" label={t('dashboard.expenses')} />
        </>
      }
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barGap={2}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
              tickFormatter={(value: number) => money(value)}
            />
            <Tooltip
              cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    label={String(label)}
                    rows={[
                      {
                        color: 'var(--chart-income)',
                        name: t('dashboard.income'),
                        value: formatMoney(Number(payload[0]?.value ?? 0), currency, lang),
                      },
                      {
                        color: 'var(--chart-expense)',
                        name: t('dashboard.expenses'),
                        value: formatMoney(Number(payload[1]?.value ?? 0), currency, lang),
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="income" fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expense" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
