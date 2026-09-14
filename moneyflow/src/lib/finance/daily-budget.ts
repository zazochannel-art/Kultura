/**
 * "How much can I spend today?" — the one number MONEYFLOW exists to answer.
 *
 *   availableMoney = currentBalance
 *                  - reservedMoney            (debts due this month, buffer)
 *                  - remainingFixedExpenses   (recurring charges still to come)
 *                  - savingsTargetRemaining   (what is still owed to savings)
 *                  + upcomingIncome           (recurring income still to arrive)
 *
 *   dailyBudget = availableMoney / remainingDaysInMonth
 *
 * Two deliberate choices:
 *
 *  - Upcoming recurring income counts. Leaving it out makes anyone paid late in
 *    the month look broke for three weeks. It is a separate line in the
 *    breakdown so the user can see exactly what is being assumed.
 *  - Where the user has set category budgets, the allowance is the *smaller* of
 *    the cash-flow figure and what the budgets still permit. A budget the user
 *    set themselves should not be quietly overridden by available cash.
 */

import { remainingDaysInMonth } from './period';

export interface DailyBudgetInput {
  /** Sum of balances across accounts that count toward the total. */
  currentBalance: number;
  /** Debts due this month plus anything else ring-fenced. */
  reservedMoney: number;
  /** Recurring expenses still due between today and month end. */
  remainingFixedExpenses: number;
  /** Recurring income still expected between today and month end. */
  upcomingIncome: number;
  /** Monthly savings target from the profile. */
  savingsTarget: number;
  /** Already moved into savings or goals this month. */
  savedThisMonth: number;
  /** Spent so far today (expenses only). */
  spentToday: number;
  /** Spent so far this month (expenses only). */
  spentThisMonth: number;
  /** Total of the user's category budgets for this month; null when unset. */
  budgetTotal: number | null;
  /** Spent this month inside budgeted categories. */
  budgetSpent: number;
  now?: Date;
}

export type DailyBudgetStatus = 'on_track' | 'near_limit' | 'over' | 'negative';

export interface DailyBudgetResult {
  availableMoney: number;
  dailyBudget: number;
  /** Today's allowance minus what is already spent today. Never below zero. */
  canSpendToday: number;
  /** How far today's spending has gone past the allowance, or 0. */
  overBy: number;
  spentToday: number;
  remainingDays: number;
  status: DailyBudgetStatus;
  /** 0-1, today's spending against today's allowance. */
  usedRatio: number;
  /** True when budgets, not cash flow, are the binding constraint. */
  limitedByBudget: boolean;
  breakdown: {
    currentBalance: number;
    reservedMoney: number;
    remainingFixedExpenses: number;
    savingsTargetRemaining: number;
    upcomingIncome: number;
    cashFlowDaily: number;
    budgetDaily: number | null;
  };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDailyBudget(input: DailyBudgetInput): DailyBudgetResult {
  const now = input.now ?? new Date();
  const remainingDays = remainingDaysInMonth(now);

  const savingsTargetRemaining = Math.max(0, input.savingsTarget - input.savedThisMonth);

  const availableMoney =
    input.currentBalance -
    Math.max(0, input.reservedMoney) -
    Math.max(0, input.remainingFixedExpenses) -
    savingsTargetRemaining +
    Math.max(0, input.upcomingIncome);

  const cashFlowDaily = availableMoney / remainingDays;

  // Budgets, when the user has set them, cap the allowance.
  let budgetDaily: number | null = null;
  if (input.budgetTotal !== null && input.budgetTotal > 0) {
    budgetDaily = Math.max(0, input.budgetTotal - input.budgetSpent) / remainingDays;
  }

  const rawDaily =
    budgetDaily === null ? cashFlowDaily : Math.min(cashFlowDaily, budgetDaily);
  const limitedByBudget = budgetDaily !== null && budgetDaily < cashFlowDaily;

  const dailyBudget = Math.max(0, rawDaily);
  const canSpendToday = Math.max(0, dailyBudget - input.spentToday);
  const overBy = Math.max(0, input.spentToday - dailyBudget);
  const usedRatio = dailyBudget > 0 ? Math.min(input.spentToday / dailyBudget, 2) : 1;

  let status: DailyBudgetStatus;
  if (availableMoney < 0) status = 'negative';
  else if (overBy > 0) status = 'over';
  else if (usedRatio >= 0.8) status = 'near_limit';
  else status = 'on_track';

  return {
    availableMoney: round2(availableMoney),
    dailyBudget: round2(dailyBudget),
    canSpendToday: round2(canSpendToday),
    overBy: round2(overBy),
    spentToday: round2(input.spentToday),
    remainingDays,
    status,
    usedRatio,
    limitedByBudget,
    breakdown: {
      currentBalance: round2(input.currentBalance),
      reservedMoney: round2(Math.max(0, input.reservedMoney)),
      remainingFixedExpenses: round2(Math.max(0, input.remainingFixedExpenses)),
      savingsTargetRemaining: round2(savingsTargetRemaining),
      upcomingIncome: round2(Math.max(0, input.upcomingIncome)),
      cashFlowDaily: round2(cashFlowDaily),
      budgetDaily: budgetDaily === null ? null : round2(budgetDaily),
    },
  };
}
