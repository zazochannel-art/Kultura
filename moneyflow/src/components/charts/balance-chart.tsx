'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, ChartTooltip } from './chart-shell';
import { useI18n } from '@/lib/i18n/context';
import { formatDate, formatMoney } from '@/lib/format';

export interface BalancePoint {
  day: string;
  balance: number;
}

/** One series, so no legend — the title names it. */
export function BalanceChart({ data }: { data: BalancePoint[] }) {
  const { t, lang, currency } = useI18n();
  const latest = data.at(-1)?.balance ?? 0;
  const first = data[0]?.balance ?? 0;
  const delta = latest - first;

  return (
    <ChartShell
      title={t('analytics.balanceTrend')}
      headline={formatMoney(latest, currency, lang)}
      sub={`${delta >= 0 ? '+' : '−'}${formatMoney(Math.abs(delta), currency, lang)}`}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="mf-balance-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-balance)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-balance)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
              tickFormatter={(value: string) => formatDate(value, lang, 'short')}
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
              cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    label={formatDate(String(label), lang, 'medium')}
                    rows={[
                      {
                        color: 'var(--chart-balance)',
                        name: t('dashboard.totalBalance'),
                        value: formatMoney(Number(payload[0]?.value ?? 0), currency, lang),
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="var(--chart-balance)"
              strokeWidth={2}
              fill="url(#mf-balance-fill)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
