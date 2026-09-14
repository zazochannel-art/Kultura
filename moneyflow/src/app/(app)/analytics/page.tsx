import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { BalanceChart } from '@/components/charts/balance-chart';
import { BudgetVsActual } from '@/components/charts/budget-vs-actual';
import { CategoryBreakdown } from '@/components/charts/category-breakdown';
import { IncomeExpenseChart } from '@/components/charts/income-expense-chart';
import { SavingsChart } from '@/components/charts/savings-chart';
import { PeriodFilter, isPeriod, type Period } from '@/components/analytics/period-filter';
import { ScoreDetail } from '@/components/analytics/score-detail';
import { createClient } from '@/lib/supabase/server';
import { getFinancialSnapshot } from '@/lib/data/snapshot';
import { getT } from '@/lib/i18n/server';
import { formatMoney, formatMonthName } from '@/lib/format';
import { toDateOnly } from '@/lib/finance/period';
import type { BalanceSeriesRow, CategoryTotalsRow, MonthlyTotalsRow } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Statistici' };
export const dynamic = 'force-dynamic';

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '3m': 92, '6m': 183, '1y': 365 };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.period) ? params.period[0] : params.period;
  const period: Period = isPeriod(raw) ? raw : '30d';

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - PERIOD_DAYS[period] + 1);
  const fromStr = toDateOnly(from);
  const toStr = toDateOnly(now);

  const supabase = await createClient();
  const snapshot = await getFinancialSnapshot(now);
  if (!snapshot) redirect('/login');

  const [monthlyRes, categoryRes, balanceRes] = await Promise.all([
    supabase.rpc('mf_monthly_totals', { p_from: fromStr, p_to: toStr }),
    supabase.rpc('mf_category_totals', { p_from: fromStr, p_to: toStr, p_type: 'expense' }),
    supabase.rpc('mf_balance_series', { p_from: fromStr, p_to: toStr }),
  ]);

  const { t, lang } = await getT(snapshot.profile.language);
  const currency = snapshot.profile.currency;

  const monthly = ((monthlyRes.data ?? []) as MonthlyTotalsRow[]).map((row) => {
    const date = new Date(row.period);
    return {
      label: formatMonthName(date.getFullYear(), date.getMonth() + 1, lang).split(' ')[0] ?? '',
      income: Number(row.income),
      expense: Number(row.expense),
    };
  });

  const categories = ((categoryRes.data ?? []) as CategoryTotalsRow[]).map((row) => ({
    id: row.category_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    total: Number(row.total),
  }));

  const balance = ((balanceRes.data ?? []) as BalanceSeriesRow[]).map((row) => ({
    day: row.day,
    balance: Number(row.balance),
  }));

  const budgetPoints = snapshot.budgetLines
    .slice(0, 6)
    .map((line) => ({ name: line.category.name, planned: line.planned, actual: line.spent }));

  const totalExpense = categories.reduce((sum, row) => sum + row.total, 0);
  const avgDaily = totalExpense / PERIOD_DAYS[period];
  const biggest = categories[0];

  const emergencyGap = Math.max(
    0,
    (snapshot.profile.emergency_fund_target || snapshot.monthExpenses * 3) - snapshot.savingsBalance,
  );

  const hasData = categories.length > 0 || monthly.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader title={t('analytics.title')} />

      <Suspense fallback={<Skeleton className="h-11 w-full rounded-xl" />}>
        <PeriodFilter value={period} />
      </Suspense>

      {!hasData ? (
        <EmptyState icon={BarChart3} title={t('analytics.empty')} description={t('analytics.emptyHint')} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('analytics.avgDaily')}</p>
                <p className="mf-tabular mt-1 text-xl font-semibold">
                  {formatMoney(avgDaily, currency, lang)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('analytics.biggestExpense')}</p>
                <p className="mf-tabular mt-1 truncate text-xl font-semibold">
                  {biggest ? `${biggest.name} · ${formatMoney(biggest.total, currency, lang)}` : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          <BalanceChart data={balance} />

          {monthly.length > 0 ? <IncomeExpenseChart data={monthly} /> : null}

          {categories.length > 0 ? <CategoryBreakdown slices={categories} /> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {monthly.length > 0 ? <SavingsChart data={monthly} /> : null}
            {budgetPoints.length > 0 ? <BudgetVsActual data={budgetPoints} /> : null}
          </div>

          <ScoreDetail
            score={snapshot.moneyScore}
            savingsTarget={snapshot.profile.monthly_savings_target}
            savedThisMonth={snapshot.savedThisMonth}
            emergencyGap={emergencyGap}
            debtOwed={snapshot.debtOwed}
          />
        </>
      )}
    </div>
  );
}
