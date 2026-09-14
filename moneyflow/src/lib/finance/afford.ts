/**
 * "Can I afford it?" — a verdict with the reasoning attached.
 *
 * The question is never just "is there enough in the account". It is: what does
 * this purchase do to the rest of the month, to the savings target, and to the
 * goals already in flight. So the answer carries all three.
 */

import type { DailyBudgetResult } from './daily-budget';
import { round2 } from './daily-budget';

export type AffordVerdict = 'yes' | 'careful' | 'no';

export interface AffordInput {
  price: number;
  budget: DailyBudgetResult;
  /** Liquid savings that could be raided, if the user chose to. */
  savingsBalance: number;
  monthlySavingsTarget: number;
  goals: Array<{ id: string; name: string; monthly_contribution: number; target_amount: number; current_amount: number }>;
}

export interface AffordReasonKey {
  key: string;
  values?: Record<string, number | string>;
}

export interface AffordResult {
  verdict: AffordVerdict;
  price: number;
  /** Money left for the rest of the month after the purchase. */
  remainingAfter: number;
  /** Daily allowance for the rest of the month after the purchase. */
  dailyAfter: number;
  /** How much of the current daily allowance survives, 0-1+. */
  dailyRetained: number;
  /**
   * Months the savings plan slips by. Zero for a purchase that fits inside
   * `availableMoney` — that figure already has the savings target deducted, so
   * spending within it never touches savings.
   */
  savingsDelayMonths: number;
  /** Months of saving needed before this is comfortable, when the answer is no. */
  monthsToAfford: number | null;
  /** The goal that takes the biggest hit, if any. */
  affectedGoal: { name: string; monthsDelayed: number } | null;
  /** Would need to dip into savings to complete the purchase. */
  usesSavings: boolean;
  reasons: AffordReasonKey[];
}

/**
 * Below this share of the normal daily allowance the rest of the month stops
 * being livable, and "yes" stops being an honest answer.
 */
const COMFORT_FLOOR = 0.6;

export function evaluateAfford(input: AffordInput): AffordResult {
  const price = Math.max(0, input.price);
  const { availableMoney, dailyBudget, remainingDays } = input.budget;

  const remainingAfter = availableMoney - price;
  const dailyAfter = remainingAfter / remainingDays;
  const dailyRetained = dailyBudget > 0 ? dailyAfter / dailyBudget : dailyAfter > 0 ? 1 : 0;

  // Only the part of the price that overshoots `availableMoney` comes out of
  // savings; the rest is money the month had already set aside for spending.
  const savingsImpact = Math.max(0, price - availableMoney);
  const savingsDelayMonths =
    input.monthlySavingsTarget > 0 ? savingsImpact / input.monthlySavingsTarget : 0;

  const usesSavings = remainingAfter < 0 && input.savingsBalance + remainingAfter >= 0;

  // The goal that loses the most months if this money goes elsewhere.
  let affectedGoal: AffordResult['affectedGoal'] = null;
  const contributing = input.goals.filter((g) => g.monthly_contribution > 0);
  if (contributing.length > 0 && price > 0) {
    const worst = contributing.reduce((a, b) =>
      price / a.monthly_contribution > price / b.monthly_contribution ? a : b,
    );
    affectedGoal = {
      name: worst.name,
      monthsDelayed: Math.round((price / worst.monthly_contribution) * 10) / 10,
    };
  }

  const reasons: AffordReasonKey[] = [];
  let verdict: AffordVerdict;

  if (price === 0) {
    verdict = 'yes';
    reasons.push({ key: 'afford.reason.free' });
  } else if (remainingAfter >= 0 && dailyRetained >= COMFORT_FLOOR) {
    verdict = 'yes';
    reasons.push({
      key: 'afford.reason.fits',
      values: { daily: round2(dailyAfter), days: remainingDays },
    });
    if (savingsDelayMonths === 0) {
      reasons.push({ key: 'afford.reason.savings_safe' });
    }
  } else if (remainingAfter >= 0) {
    verdict = 'careful';
    reasons.push({
      key: 'afford.reason.tight',
      values: { daily: round2(dailyAfter), days: remainingDays },
    });
    if (savingsDelayMonths >= 0.5) {
      reasons.push({
        key: 'afford.reason.savings_delay',
        values: { months: Math.round(savingsDelayMonths * 10) / 10 },
      });
    }
  } else if (usesSavings && savingsDelayMonths <= 3) {
    verdict = 'careful';
    reasons.push({
      key: 'afford.reason.from_savings',
      values: { amount: round2(Math.abs(remainingAfter)) },
    });
    reasons.push({
      key: 'afford.reason.savings_delay',
      values: { months: Math.round(savingsDelayMonths * 10) / 10 },
    });
  } else {
    verdict = 'no';
    reasons.push({
      key: 'afford.reason.short',
      values: { amount: round2(Math.abs(remainingAfter)) },
    });
    if (savingsDelayMonths >= 1) {
      reasons.push({
        key: 'afford.reason.savings_delay',
        values: { months: Math.round(savingsDelayMonths * 10) / 10 },
      });
    }
  }

  if (affectedGoal && affectedGoal.monthsDelayed >= 0.5 && verdict !== 'yes') {
    reasons.push({
      key: 'afford.reason.goal_delay',
      values: { goal: affectedGoal.name, months: affectedGoal.monthsDelayed },
    });
  }

  let monthsToAfford: number | null = null;
  if (verdict === 'no') {
    const perMonth = input.monthlySavingsTarget > 0 ? input.monthlySavingsTarget : 0;
    if (perMonth > 0) {
      monthsToAfford = Math.ceil(Math.abs(remainingAfter) / perMonth);
      reasons.push({ key: 'afford.reason.wait', values: { months: monthsToAfford } });
    }
  }

  return {
    verdict,
    price: round2(price),
    remainingAfter: round2(remainingAfter),
    dailyAfter: round2(dailyAfter),
    dailyRetained: Math.round(dailyRetained * 100) / 100,
    savingsDelayMonths: Math.round(savingsDelayMonths * 10) / 10,
    monthsToAfford,
    affectedGoal,
    usesSavings,
    reasons,
  };
}

/**
 * Months until a goal is reached at its current contribution rate, and whether
 * that lands before the deadline.
 */
export function goalForecast(goal: {
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  deadline: string | null;
}): { months: number | null; onTrack: boolean | null; requiredMonthly: number | null } {
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  if (remaining === 0) return { months: 0, onTrack: true, requiredMonthly: 0 };

  const months = goal.monthly_contribution > 0
    ? Math.ceil(remaining / goal.monthly_contribution)
    : null;

  if (!goal.deadline) return { months, onTrack: null, requiredMonthly: null };

  const deadline = new Date(goal.deadline);
  const now = new Date();
  const monthsLeft = Math.max(
    0,
    (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()),
  );
  const requiredMonthly = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;

  return {
    months,
    onTrack: months !== null && months <= monthsLeft,
    requiredMonthly,
  };
}
