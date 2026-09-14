import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CanSpendCard } from '@/components/dashboard/can-spend-card';
import { BalanceSummary } from '@/components/dashboard/balance-summary';
import { MoneyScoreCard } from '@/components/dashboard/money-score-card';
import { UpcomingBills } from '@/components/dashboard/upcoming-bills';
import { GoalsProgress } from '@/components/dashboard/goals-progress';
import { BudgetsOverview } from '@/components/dashboard/budgets-overview';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { getFinancialSnapshot } from '@/lib/data/snapshot';
import { syncNotifications } from '@/lib/data/notifications';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { daysUntilPayday } from '@/lib/finance/period';

export const metadata: Metadata = { title: 'Panou' };

// Money changes on every write; a cached dashboard is a wrong dashboard.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Recurring charges that came due while the app was closed are posted here,
  // before anything reads a balance, so the dashboard never shows a number
  // that yesterday's rent has already invalidated.
  const supabase = await createClient();
  await supabase.rpc('mf_run_due_recurring');

  const snapshot = await getFinancialSnapshot();
  if (!snapshot) redirect('/login');

  await syncNotifications(snapshot);

  const { t } = await getT(snapshot.profile.language);
  const untilPayday = daysUntilPayday(snapshot.profile.payday_day, snapshot.now);
  const firstName = snapshot.profile.name?.trim().split(/\s+/)[0];

  const emergencyGap = Math.max(
    0,
    (snapshot.profile.emergency_fund_target || snapshot.monthExpenses * 3) - snapshot.savingsBalance,
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('dashboard.greeting', { name: firstName ? `, ${firstName}` : '' })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {untilPayday === 0
            ? t('dashboard.nextPaydayToday')
            : t('dashboard.nextPayday', { days: untilPayday })}
        </p>
      </header>

      <CanSpendCard budget={snapshot.dailyBudget} />

      <div className="grid gap-4 sm:grid-cols-2">
        <BalanceSummary
          total={snapshot.totalBalance}
          income={snapshot.monthIncome}
          expenses={snapshot.monthExpenses}
          savings={snapshot.savedThisMonth}
        />
        <MoneyScoreCard
          score={snapshot.moneyScore}
          savingsTarget={snapshot.profile.monthly_savings_target}
          savedThisMonth={snapshot.savedThisMonth}
          emergencyGap={emergencyGap}
          debtOwed={snapshot.debtOwed}
          compact
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetsOverview lines={snapshot.budgetLines} />
        <GoalsProgress goals={snapshot.goals} />
        <UpcomingBills bills={snapshot.upcomingBills} />
        <RecentTransactions transactions={snapshot.recentTransactions} />
      </div>
    </div>
  );
}
