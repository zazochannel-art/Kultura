import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type {
  Account,
  Budget,
  BudgetCategory,
  Category,
  Debt,
  Goal,
  Profile,
  RecurringTransaction,
  Transaction,
  TransactionWithRelations,
} from '@/lib/types/database';
import {
  calculateDailyBudget,
  round2,
  type DailyBudgetResult,
} from '@/lib/finance/daily-budget';
import { calculateMoneyScore, type MoneyScoreResult } from '@/lib/finance/money-score';
import {
  currentMonth,
  daysBetween,
  monthEnd,
  monthStart,
  occurrencesBetween,
  parseDateOnly,
  startOfDay,
  toDateOnly,
} from '@/lib/finance/period';

/** PostgREST can hand numerics back as strings; nothing downstream should care. */
function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export interface BudgetLine {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'>;
  planned: number;
  spent: number;
  remaining: number;
  ratio: number;
  status: 'safe' | 'near_limit' | 'over';
}

export interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  date: string;
  daysUntil: number;
  type: 'income' | 'expense';
  categoryId: string | null;
}

export interface CategorySpend {
  id: string | null;
  name: string;
  icon: string;
  color: string;
  total: number;
  count: number;
}

export interface FinancialSnapshot {
  profile: Profile;
  accounts: Account[];
  categories: Category[];
  totalBalance: number;
  savingsBalance: number;
  monthIncome: number;
  monthExpenses: number;
  savedThisMonth: number;
  spentToday: number;
  recurring: RecurringTransaction[];
  remainingFixedExpenses: number;
  upcomingIncome: number;
  upcomingBills: UpcomingBill[];
  recurringMonthlyTotal: number;
  budget: Budget | null;
  budgetLines: BudgetLine[];
  budgetTotal: number | null;
  budgetSpent: number;
  goals: Goal[];
  debts: Debt[];
  debtOwed: number;
  debtOwedToMe: number;
  reservedMoney: number;
  dailyBudget: DailyBudgetResult;
  moneyScore: MoneyScoreResult;
  categorySpend: CategorySpend[];
  dailySpending: number[];
  recentTransactions: TransactionWithRelations[];
  monthTransactionCount: number;
  now: Date;
}

const TX_SELECT = `
  id, user_id, account_id, to_account_id, category_id, goal_id, recurring_id,
  type, amount, description, notes, date, created_at, updated_at,
  category:categories!transactions_category_id_fkey (id, name, icon, color),
  account:accounts!transactions_account_id_fkey (id, name, color, type),
  to_account:accounts!transactions_to_account_id_fkey (id, name, color, type)
`;

/**
 * Everything the intelligent surfaces need, fetched once.
 *
 * The dashboard, Money Score, "can I afford it" and the AI assistant all ask
 * the same questions of the same data. Assembling that once — in parallel, with
 * a single transaction window wide enough to serve all of them — keeps those
 * four features honestly consistent with each other, which matters more here
 * than anywhere else: two screens disagreeing about how much money you have is
 * worse than either screen being slow.
 */
export async function getFinancialSnapshot(now = new Date()): Promise<FinancialSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const month = currentMonth(now);
  const monthFrom = toDateOnly(monthStart(month));
  const monthTo = toDateOnly(monthEnd(month));
  const today = toDateOnly(now);

  // Wide enough for the 30-day consistency window and this month's totals.
  const windowFrom = toDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 45));

  const [
    profileRes,
    accountsRes,
    categoriesRes,
    txRes,
    recurringRes,
    budgetRes,
    goalsRes,
    debtsRes,
    contributionsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('accounts').select('*').eq('is_archived', false).order('created_at'),
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase
      .from('transactions')
      .select(TX_SELECT)
      .gte('date', windowFrom)
      .lte('date', monthTo)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('recurring_transactions').select('*').eq('is_active', true).order('next_date'),
    supabase
      .from('budgets')
      .select('*, budget_categories(*)')
      .eq('year', month.year)
      .eq('month', month.month)
      .maybeSingle(),
    supabase.from('goals').select('*').neq('status', 'archived').order('created_at'),
    supabase.from('debts').select('*').eq('status', 'open').order('due_date', { nullsFirst: false }),
    supabase.from('goal_contributions').select('amount, date').gte('date', monthFrom).lte('date', monthTo),
  ]);

  const profile = profileRes.data as Profile | null;
  if (!profile) return null;

  const accounts = ((accountsRes.data ?? []) as Account[]).map((a) => ({
    ...a,
    balance: num(a.balance),
  }));
  const categories = (categoriesRes.data ?? []) as Category[];
  const transactions = ((txRes.data ?? []) as unknown as TransactionWithRelations[]).map((t) => ({
    ...t,
    amount: num(t.amount),
  }));
  const recurring = ((recurringRes.data ?? []) as RecurringTransaction[]).map((r) => ({
    ...r,
    amount: num(r.amount),
  }));
  const goals = ((goalsRes.data ?? []) as Goal[]).map((g) => ({
    ...g,
    target_amount: num(g.target_amount),
    current_amount: num(g.current_amount),
    monthly_contribution: num(g.monthly_contribution),
  }));
  const debts = ((debtsRes.data ?? []) as Debt[]).map((d) => ({ ...d, amount: num(d.amount) }));

  const totalBalance = accounts
    .filter((a) => a.include_in_total)
    .reduce((sum, a) => sum + a.balance, 0);
  const savingsBalance = accounts
    .filter((a) => a.type === 'savings')
    .reduce((sum, a) => sum + a.balance, 0);

  // --- this month -----------------------------------------------------------

  const monthTx = transactions.filter((t) => t.date >= monthFrom && t.date <= monthTo);
  const monthIncome = sumBy(monthTx, (t) => (t.type === 'income' ? t.amount : 0));
  const monthExpenses = sumBy(monthTx, (t) => (t.type === 'expense' ? t.amount : 0));
  const spentToday = sumBy(monthTx, (t) => (t.type === 'expense' && t.date === today ? t.amount : 0));

  const savingsAccountIds = new Set(accounts.filter((a) => a.type === 'savings').map((a) => a.id));
  const transferredToSavings = sumBy(monthTx, (t) =>
    t.type === 'transfer' && t.to_account_id && savingsAccountIds.has(t.to_account_id)
      ? t.amount
      : 0,
  );
  const goalContributions = sumBy(
    (contributionsRes.data ?? []) as Array<{ amount: unknown }>,
    (row) => num(row.amount),
  );
  // A transfer into a savings account and a goal contribution funded from that
  // same transfer are the same money; count the larger, never both.
  const savedThisMonth = Math.max(transferredToSavings, goalContributions);

  // --- recurring ------------------------------------------------------------

  const todayStart = startOfDay(now);
  const endOfMonth = monthEnd(month);

  let remainingFixedExpenses = 0;
  let upcomingIncome = 0;
  const upcomingBills: UpcomingBill[] = [];

  for (const entry of recurring) {
    const next = parseDateOnly(entry.next_date);
    const limit = entry.end_date ? parseDateOnly(entry.end_date) : endOfMonth;
    const until = limit < endOfMonth ? limit : endOfMonth;
    const occurrences = occurrencesBetween(next, entry.frequency, todayStart, until);

    const total = occurrences.length * entry.amount;
    if (entry.type === 'expense') remainingFixedExpenses += total;
    else upcomingIncome += total;

    for (const occurrence of occurrences.slice(0, 3)) {
      upcomingBills.push({
        id: `${entry.id}:${toDateOnly(occurrence)}`,
        name: entry.name,
        amount: entry.amount,
        date: toDateOnly(occurrence),
        daysUntil: daysBetween(todayStart, occurrence),
        type: entry.type,
        categoryId: entry.category_id,
      });
    }
  }
  upcomingBills.sort((a, b) => a.date.localeCompare(b.date));

  const recurringMonthlyTotal = recurring
    .filter((r) => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount * monthlyFactor(r.frequency), 0);

  // --- budgets --------------------------------------------------------------

  const budgetRow = budgetRes.data as (Budget & { budget_categories: BudgetCategory[] }) | null;
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const spentByCategory = new Map<string, { total: number; count: number }>();
  for (const t of monthTx) {
    if (t.type !== 'expense') continue;
    const key = t.category_id ?? 'uncategorised';
    const existing = spentByCategory.get(key) ?? { total: 0, count: 0 };
    existing.total += t.amount;
    existing.count += 1;
    spentByCategory.set(key, existing);
  }

  const budgetLines: BudgetLine[] = (budgetRow?.budget_categories ?? [])
    .map((line) => {
      const category = categoryById.get(line.category_id);
      if (!category) return null;
      const planned = num(line.amount);
      const spent = spentByCategory.get(line.category_id)?.total ?? 0;
      const ratio = planned > 0 ? spent / planned : 0;
      return {
        category: {
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
        },
        planned,
        spent: round2(spent),
        remaining: round2(planned - spent),
        ratio,
        status: ratio > 1 ? 'over' : ratio >= 0.8 ? 'near_limit' : 'safe',
      } satisfies BudgetLine;
    })
    .filter((line): line is BudgetLine => line !== null)
    .sort((a, b) => b.ratio - a.ratio);

  const budgetTotal = budgetLines.length > 0
    ? budgetLines.reduce((sum, l) => sum + l.planned, 0)
    : null;
  const budgetSpent = budgetLines.reduce((sum, l) => sum + l.spent, 0);

  // --- debts ----------------------------------------------------------------

  const debtOwed = sumBy(debts, (d) => (d.direction === 'i_owe' ? d.amount : 0));
  const debtOwedToMe = sumBy(debts, (d) => (d.direction === 'owed_to_me' ? d.amount : 0));

  // Only what is actually due before month end is ring-fenced; a debt with no
  // date, or one due later, should not shrink today's allowance.
  const reservedMoney = sumBy(debts, (d) => {
    if (d.direction !== 'i_owe' || !d.due_date) return 0;
    return parseDateOnly(d.due_date) <= endOfMonth ? d.amount : 0;
  });

  // --- the number -----------------------------------------------------------

  const dailyBudget = calculateDailyBudget({
    currentBalance: totalBalance,
    reservedMoney,
    remainingFixedExpenses,
    upcomingIncome,
    savingsTarget: num(profile.monthly_savings_target),
    savedThisMonth,
    spentToday,
    spentThisMonth: monthExpenses,
    budgetTotal,
    budgetSpent,
    now,
  });

  // --- score ----------------------------------------------------------------

  const dailySpending = buildDailySeries(transactions, now, 30);

  const moneyScore = calculateMoneyScore({
    monthlyIncome: monthIncome > 0 ? monthIncome : num(profile.monthly_income),
    monthlyExpenses: monthExpenses,
    monthlySaved: savedThisMonth,
    budgetTotal,
    budgetSpent,
    emergencyFund: savingsBalance,
    emergencyFundTarget: num(profile.emergency_fund_target),
    debtOwed,
    dailySpending,
    goals: goals.map((g) => ({ current: g.current_amount, target: g.target_amount })),
    recurringMonthly: recurringMonthlyTotal,
  });

  const categorySpend: CategorySpend[] = [...spentByCategory.entries()]
    .map(([key, value]) => {
      const category = key === 'uncategorised' ? null : categoryById.get(key);
      return {
        id: category?.id ?? null,
        name: category?.name ?? 'Other',
        icon: category?.icon ?? 'Package',
        color: category?.color ?? '#71717A',
        total: round2(value.total),
        count: value.count,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    profile: {
      ...profile,
      monthly_income: num(profile.monthly_income),
      monthly_savings_target: num(profile.monthly_savings_target),
      emergency_fund_target: num(profile.emergency_fund_target),
    },
    accounts,
    categories,
    totalBalance: round2(totalBalance),
    savingsBalance: round2(savingsBalance),
    monthIncome: round2(monthIncome),
    monthExpenses: round2(monthExpenses),
    savedThisMonth: round2(savedThisMonth),
    spentToday: round2(spentToday),
    recurring,
    remainingFixedExpenses: round2(remainingFixedExpenses),
    upcomingIncome: round2(upcomingIncome),
    upcomingBills: upcomingBills.slice(0, 6),
    recurringMonthlyTotal: round2(recurringMonthlyTotal),
    budget: budgetRow ? { ...budgetRow, amount: num(budgetRow.amount) } : null,
    budgetLines,
    budgetTotal,
    budgetSpent: round2(budgetSpent),
    goals,
    debts,
    debtOwed: round2(debtOwed),
    debtOwedToMe: round2(debtOwedToMe),
    reservedMoney: round2(reservedMoney),
    dailyBudget,
    moneyScore,
    categorySpend,
    dailySpending,
    recentTransactions: transactions.slice(0, 8),
    monthTransactionCount: monthTx.length,
    now,
  };
}

function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + pick(row), 0);
}

/** How many times a frequency lands in an average month. */
function monthlyFactor(frequency: string): number {
  switch (frequency) {
    case 'daily':
      return 30;
    case 'weekly':
      return 52 / 12;
    case 'biweekly':
      return 26 / 12;
    case 'quarterly':
      return 1 / 3;
    case 'yearly':
      return 1 / 12;
    case 'monthly':
    default:
      return 1;
  }
}

/** Expense totals per day for the last `days` days, oldest first. */
function buildDailySeries(transactions: Transaction[], now: Date, days: number): number[] {
  const byDay = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  }

  const series: number[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    series.push(byDay.get(toDateOnly(day)) ?? 0);
  }
  return series;
}
