'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartShell, ChartTooltip } from './chart-shell';
import { IconBadge } from '@/components/shared/icon-badge';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney, formatPercent } from '@/lib/format';

export interface CategorySlice {
  id: string | null;
  name: string;
  icon: string;
  color: string;
  total: number;
}

const MAX_SLICES = 6;

/**
 * Where the money went, by category.
 *
 * Each slice wears its own category's colour — the same colour that category has
 * on every other screen — so the chart reads as the app rather than as a chart.
 * Identity never rests on colour alone: every slice is direct-labelled in the
 * list beside it, which doubles as the table view. Past six categories the tail
 * folds into "Other" rather than inventing more hues.
 */
export function CategoryBreakdown({ slices }: { slices: CategorySlice[] }) {
  const { t, lang, currency } = useI18n();

  const sorted = [...slices].sort((a, b) => b.total - a.total);
  const head = sorted.slice(0, MAX_SLICES);
  const tail = sorted.slice(MAX_SLICES);

  const data =
    tail.length > 0
      ? [
          ...head,
          {
            id: 'other',
            name: t('common.none'),
            icon: 'Package',
            color: 'var(--chart-axis)',
            total: tail.reduce((sum, slice) => sum + slice.total, 0),
          },
        ]
      : head;

  const total = data.reduce((sum, slice) => sum + slice.total, 0);

  return (
    <ChartShell
      title={t('analytics.byCategory')}
      headline={formatMoney(total, currency, lang)}
      sub={t('dashboard.expenses')}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="name"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {data.map((slice) => (
                  <Cell key={slice.id ?? slice.name} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const slice = payload[0]?.payload as CategorySlice;
                  return (
                    <ChartTooltip
                      label={slice.name}
                      rows={[
                        {
                          color: slice.color,
                          name: t('common.total'),
                          value: formatMoney(slice.total, currency, lang),
                        },
                      ]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-2">
          {data.map((slice) => (
            <li key={slice.id ?? slice.name} className="flex items-center gap-2.5">
              <IconBadge icon={slice.icon} color={slice.color} size="sm" className="size-7 rounded-lg" />
              <span className="min-w-0 flex-1 truncate text-sm">{slice.name}</span>
              <span className="mf-tabular shrink-0 text-sm font-medium">
                {formatMoney(slice.total, currency, lang)}
              </span>
              <span className="mf-tabular w-10 shrink-0 text-right text-xs text-muted-foreground">
                {formatPercent(total > 0 ? slice.total / total : 0, lang)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartShell>
  );
}
