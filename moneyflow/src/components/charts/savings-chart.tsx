'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, ChartTooltip } from './chart-shell';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';
import type { MonthPoint } from './income-expense-chart';

/** Money kept each month: income minus expenses. One series, no legend. */
export function SavingsChart({ data }: { data: MonthPoint[] }) {
  const { t, lang, currency } = useI18n();

  const points = data.map((point) => ({ label: point.label, saved: point.income - point.expense }));
  const total = points.reduce((sum, point) => sum + point.saved, 0);

  return (
    <ChartShell
      title={t('analytics.savingsTrend')}
      headline={formatMoney(total, currency, lang)}
      sub={t('reports.savings')}
    >
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
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
              tickFormatter={(value: number) =>
                formatMoney(value, currency, lang, { compact: Math.abs(value) >= 10000 })
              }
            />
            <Tooltip
              cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    label={String(label)}
                    rows={[
                      {
                        color: 'var(--chart-3)',
                        name: t('reports.savings'),
                        value: formatMoney(Number(payload[0]?.value ?? 0), currency, lang),
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="saved" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
