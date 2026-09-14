import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getFinancialSnapshot, type FinancialSnapshot } from '@/lib/data/snapshot';
import { addMonths, currentMonth, monthRange, toDateOnly } from '@/lib/finance/period';
import { goalForecast } from '@/lib/finance/afford';
import type { MonthlyTotalsRow } from '@/lib/types/database';

/**
 * The only thing the assistant is allowed to know.
 *
 * A finance assistant that guesses is worse than no assistant, so the answer
 * path never has access to anything but this object: real balances, real
 * transactions, real budgets, real goals. If a number is not in here, the
 * correct answer is "I don't have that".
 */
export interface AssistantContext {
  currency: string;
  language: string;
  today: string;
  daysLeftInMonth: number;
  balance: { total: number; savings: number };
  month: {
    income: number;
    expenses: number;
    saved: number;
    transactionCount: number;
  };
  dailyBudget: {
    canSpendToday: number;
    perDay: number;
    availableUntilMonthEnd: number;
    spentToday: number;
    status: string;
  };
  categoriesThisMonth: Array<{ name: string; spent: number; share: number }>;
  categoriesLast6Months: Array<{ name: string; total: number; monthlyAverage: number }>;
  budgets: Array<{ category: string; planned: number; spent: number; status: string }>;
  goals: Array<{
    name: string;
    target: number;
    current: number;
    monthlyContribution: number;
    deadline: string | null;
    monthsToReach: number | null;
  }>;
  recurring: Array<{ name: string; amount: number; frequency: string; nextDate: string }>;
  debts: { iOwe: number; owedToMe: number; items: Array<{ person: string; amount: number; direction: string }> };
  monthlyHistory: Array<{ period: string; income: number; expenses: number }>;
  moneyScore: { score: number; grade: string; savingsRate: number };
  profile: { monthlyIncome: number; monthlySavingsTarget: number; emergencyFundTarget: number };
}

export async function buildAssistantContext(): Promise<
  { context: AssistantContext; snapshot: FinancialSnapshot } | null
> {
  const snapshot = await getFinancialSnapshot();
  if (!snapshot) return null;

  const supabase = await createClient();
  const now = snapshot.now;
  const sixMonthsAgo = monthRange(addMonths(currentMonth(now), -5)).from;

  const [historyRes, longCategoryRes] = await Promise.all([
    supabase.rpc('mf_monthly_totals', { p_from: sixMonthsAgo, p_to: toDateOnly(now) }),
    supabase.rpc('mf_category_totals', {
      p_from: sixMonthsAgo,
      p_to: toDateOnly(now),
      p_type: 'expense',
    }),
  ]);

  const monthlyHistory = ((historyRes.data ?? []) as MonthlyTotalsRow[]).map((row) => ({
    period: String(row.period).slice(0, 7),
    income: Number(row.income),
    expenses: Number(row.expense),
  }));

  const monthsCovered = Math.max(1, monthlyHistory.length);

  const categoriesLast6Months = (
    (longCategoryRes.data ?? []) as Array<{ name: string; total: number }>
  ).map((row) => ({
    name: row.name,
    total: Number(row.total),
    monthlyAverage: Math.round((Number(row.total) / monthsCovered) * 100) / 100,
  }));

  const monthExpenses = snapshot.monthExpenses;

  const context: AssistantContext = {
    currency: snapshot.profile.currency,
    language: snapshot.profile.language,
    today: toDateOnly(now),
    daysLeftInMonth: snapshot.dailyBudget.remainingDays,
    balance: { total: snapshot.totalBalance, savings: snapshot.savingsBalance },
    month: {
      income: snapshot.monthIncome,
      expenses: monthExpenses,
      saved: snapshot.savedThisMonth,
      transactionCount: snapshot.monthTransactionCount,
    },
    dailyBudget: {
      canSpendToday: snapshot.dailyBudget.canSpendToday,
      perDay: snapshot.dailyBudget.dailyBudget,
      availableUntilMonthEnd: snapshot.dailyBudget.availableMoney,
      spentToday: snapshot.dailyBudget.spentToday,
      status: snapshot.dailyBudget.status,
    },
    categoriesThisMonth: snapshot.categorySpend.map((row) => ({
      name: row.name,
      spent: row.total,
      share: monthExpenses > 0 ? Math.round((row.total / monthExpenses) * 100) : 0,
    })),
    categoriesLast6Months,
    budgets: snapshot.budgetLines.map((line) => ({
      category: line.category.name,
      planned: line.planned,
      spent: line.spent,
      status: line.status,
    })),
    goals: snapshot.goals.map((goal) => ({
      name: goal.name,
      target: goal.target_amount,
      current: goal.current_amount,
      monthlyContribution: goal.monthly_contribution,
      deadline: goal.deadline,
      monthsToReach: goalForecast(goal).months,
    })),
    recurring: snapshot.recurring.map((entry) => ({
      name: entry.name,
      amount: entry.amount,
      frequency: entry.frequency,
      nextDate: entry.next_date,
    })),
    debts: {
      iOwe: snapshot.debtOwed,
      owedToMe: snapshot.debtOwedToMe,
      items: snapshot.debts.map((debt) => ({
        person: debt.person_name,
        amount: debt.amount,
        direction: debt.direction,
      })),
    },
    monthlyHistory,
    moneyScore: {
      score: snapshot.moneyScore.score,
      grade: snapshot.moneyScore.grade,
      savingsRate: Math.round(snapshot.moneyScore.savingsRate * 100),
    },
    profile: {
      monthlyIncome: snapshot.profile.monthly_income,
      monthlySavingsTarget: snapshot.profile.monthly_savings_target,
      emergencyFundTarget: snapshot.profile.emergency_fund_target,
    },
  };

  return { context, snapshot };
}
