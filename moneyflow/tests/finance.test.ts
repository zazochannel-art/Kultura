/**
 * The arithmetic MONEYFLOW is built on.
 *
 * These four modules decide what the app tells someone they can spend, whether
 * a purchase is safe, and what their finances score. They are pure functions
 * with no database and no React, which is exactly why they are worth pinning
 * down: a wrong number here is wrong on every screen at once.
 *
 * Run: node --test tests/
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateDailyBudget } from '@/lib/finance/daily-budget';
import { calculateMoneyScore, weakestComponent } from '@/lib/finance/money-score';
import { evaluateAfford, goalForecast } from '@/lib/finance/afford';
import {
  advanceDate,
  daysUntilPayday,
  occurrencesBetween,
  remainingDaysInMonth,
  toDateOnly,
} from '@/lib/finance/period';
import { parseAmount, formatMoney } from '@/lib/format';

/** 15 June 2026 — mid-month, 16 days left including today. */
const MID_JUNE = new Date(2026, 5, 15, 12, 0, 0);

function budgetInput(overrides: Partial<Parameters<typeof calculateDailyBudget>[0]> = {}) {
  return {
    currentBalance: 10_000,
    reservedMoney: 0,
    remainingFixedExpenses: 0,
    upcomingIncome: 0,
    savingsTarget: 0,
    savedThisMonth: 0,
    spentToday: 0,
    spentThisMonth: 0,
    budgetTotal: null,
    budgetSpent: 0,
    now: MID_JUNE,
    ...overrides,
  };
}

// --- period ---------------------------------------------------------------

test('remaining days includes today and is never zero', () => {
  assert.equal(remainingDaysInMonth(MID_JUNE), 16);
  assert.equal(remainingDaysInMonth(new Date(2026, 5, 30)), 1);
  assert.equal(remainingDaysInMonth(new Date(2026, 1, 28)), 1); // Feb 2026, 28 days
});

test('advanceDate walks each frequency forward', () => {
  const base = new Date(2026, 0, 31);
  assert.equal(toDateOnly(advanceDate(base, 'weekly')), '2026-02-07');
  assert.equal(toDateOnly(advanceDate(base, 'biweekly')), '2026-02-14');
  assert.equal(toDateOnly(advanceDate(base, 'yearly')), '2027-01-31');
  // 31 January + one month has no 31 February; JS rolls it into March, and the
  // SQL side does the same, so the two stay in step.
  assert.equal(toDateOnly(advanceDate(base, 'monthly')), '2026-03-03');
});

test('occurrencesBetween counts only what falls inside the window', () => {
  const next = new Date(2026, 5, 20);
  const from = new Date(2026, 5, 15);
  const to = new Date(2026, 5, 30);

  assert.equal(occurrencesBetween(next, 'monthly', from, to).length, 1);
  assert.equal(occurrencesBetween(next, 'weekly', from, to).length, 2);
  // A due date already past the window contributes nothing.
  assert.equal(occurrencesBetween(new Date(2026, 6, 5), 'monthly', from, to).length, 0);
});

test('daysUntilPayday rolls into next month once the day has passed', () => {
  assert.equal(daysUntilPayday(20, MID_JUNE), 5);
  assert.equal(daysUntilPayday(15, MID_JUNE), 0);
  assert.equal(daysUntilPayday(5, MID_JUNE), 20); // 5 July
  // A 31st payday in a 30-day month clamps to the last day.
  assert.equal(daysUntilPayday(31, MID_JUNE), 15);
});

// --- daily budget ---------------------------------------------------------

test('daily budget divides what is left by the days left', () => {
  const result = calculateDailyBudget(budgetInput());
  assert.equal(result.availableMoney, 10_000);
  assert.equal(result.remainingDays, 16);
  assert.equal(result.dailyBudget, 625);
  assert.equal(result.canSpendToday, 625);
  assert.equal(result.status, 'on_track');
});

test('fixed expenses, reserved money and the savings target all come off the top', () => {
  const result = calculateDailyBudget(
    budgetInput({
      currentBalance: 14_820,
      reservedMoney: 500,
      remainingFixedExpenses: 4_500,
      savingsTarget: 2_000,
      savedThisMonth: 500,
    }),
  );

  // 14820 − 500 − 4500 − (2000 − 500) = 8320
  assert.equal(result.availableMoney, 8_320);
  assert.equal(result.breakdown.savingsTargetRemaining, 1_500);
  assert.equal(result.dailyBudget, 520);
});

test('upcoming recurring income is added, and is visible in the breakdown', () => {
  const result = calculateDailyBudget(budgetInput({ currentBalance: 2_000, upcomingIncome: 15_000 }));
  assert.equal(result.availableMoney, 17_000);
  assert.equal(result.breakdown.upcomingIncome, 15_000);
});

test('spending past the daily allowance reports over, not a negative allowance', () => {
  const result = calculateDailyBudget(budgetInput({ spentToday: 690 }));
  assert.equal(result.canSpendToday, 0);
  assert.equal(result.overBy, 65);
  assert.equal(result.status, 'over');
});

test('80% of the allowance spent is a warning, not yet a breach', () => {
  const result = calculateDailyBudget(budgetInput({ spentToday: 500 }));
  assert.equal(result.status, 'near_limit');
  assert.equal(result.overBy, 0);
});

test('planned spending beyond available money is negative, and never a negative allowance', () => {
  const result = calculateDailyBudget(
    budgetInput({ currentBalance: 1_000, remainingFixedExpenses: 4_000 }),
  );
  assert.equal(result.status, 'negative');
  assert.equal(result.availableMoney, -3_000);
  assert.equal(result.dailyBudget, 0);
  assert.equal(result.canSpendToday, 0);
});

test('category budgets cap the allowance and say so', () => {
  const result = calculateDailyBudget(
    budgetInput({ currentBalance: 20_000, budgetTotal: 4_800, budgetSpent: 800 }),
  );

  // Cash flow would allow 1250/day; the budget only allows 4000/16 = 250.
  assert.equal(result.breakdown.cashFlowDaily, 1_250);
  assert.equal(result.dailyBudget, 250);
  assert.equal(result.limitedByBudget, true);
});

test('a budget looser than the cash flow does not raise the allowance', () => {
  const result = calculateDailyBudget(budgetInput({ budgetTotal: 100_000, budgetSpent: 0 }));
  assert.equal(result.dailyBudget, 625);
  assert.equal(result.limitedByBudget, false);
});

// --- can I afford it ------------------------------------------------------

function affordInput(price: number, overrides: Record<string, unknown> = {}) {
  return {
    price,
    budget: calculateDailyBudget(budgetInput({ currentBalance: 16_000 })),
    savingsBalance: 5_000,
    monthlySavingsTarget: 2_000,
    goals: [],
    ...overrides,
  } as Parameters<typeof evaluateAfford>[0];
}

test('a purchase that leaves the month livable is a yes', () => {
  const result = evaluateAfford(affordInput(1_000));
  assert.equal(result.verdict, 'yes');
  assert.equal(result.remainingAfter, 15_000);
  assert.ok(result.dailyAfter > 900);
  // Available money already has the savings target taken out, so a purchase
  // that fits inside it does not push savings back at all.
  assert.equal(result.savingsDelayMonths, 0);
  assert.ok(result.reasons.some((reason) => reason.key === 'afford.reason.savings_safe'));
});

test('a purchase that squeezes the rest of the month is a careful, with the reason', () => {
  const result = evaluateAfford(affordInput(9_000));
  assert.equal(result.verdict, 'careful');
  assert.equal(result.remainingAfter, 7_000);
  assert.ok(result.reasons.some((reason) => reason.key === 'afford.reason.tight'));
  assert.equal(result.savingsDelayMonths, 0);
});

test('a purchase beyond reach is a no, with how long saving would take', () => {
  const result = evaluateAfford(affordInput(30_000));
  assert.equal(result.verdict, 'no');
  assert.equal(result.monthsToAfford, 7); // 14000 short / 2000 a month
  assert.equal(result.savingsDelayMonths, 7);
  assert.ok(result.reasons.some((reason) => reason.key === 'afford.reason.short'));
});

test('a small overshoot covered by savings is a careful, not a no', () => {
  const result = evaluateAfford(affordInput(18_000, { savingsBalance: 10_000 }));
  assert.equal(result.verdict, 'careful');
  assert.equal(result.usesSavings, true);
  // 2,000 over, against a 2,000/month target: one month of saving.
  assert.equal(result.savingsDelayMonths, 1);
  assert.ok(result.reasons.some((reason) => reason.key === 'afford.reason.from_savings'));
});

test('the goal that loses the most months is the one named', () => {
  const result = evaluateAfford(
    affordInput(9_000, {
      goals: [
        { id: 'a', name: 'Vacanță', monthly_contribution: 3_000, target_amount: 10_000, current_amount: 0 },
        { id: 'b', name: 'Golf 5', monthly_contribution: 1_000, target_amount: 20_000, current_amount: 0 },
      ],
    }),
  );
  assert.equal(result.affectedGoal?.name, 'Golf 5');
  assert.equal(result.affectedGoal?.monthsDelayed, 9);
});

test('goalForecast reports months left and whether the deadline holds', () => {
  const onTrack = goalForecast({
    target_amount: 20_000,
    current_amount: 12_500,
    monthly_contribution: 1_000,
    deadline: null,
  });
  assert.equal(onTrack.months, 8);
  assert.equal(onTrack.onTrack, null);

  const reached = goalForecast({
    target_amount: 10_000,
    current_amount: 10_000,
    monthly_contribution: 0,
    deadline: null,
  });
  assert.equal(reached.months, 0);

  const noContribution = goalForecast({
    target_amount: 10_000,
    current_amount: 1_000,
    monthly_contribution: 0,
    deadline: null,
  });
  assert.equal(noContribution.months, null);
});

// --- money score ----------------------------------------------------------

function scoreInput(overrides: Partial<Parameters<typeof calculateMoneyScore>[0]> = {}) {
  return {
    monthlyIncome: 15_000,
    monthlyExpenses: 10_000,
    monthlySaved: 3_000,
    budgetTotal: 10_000,
    budgetSpent: 9_000,
    emergencyFund: 45_000,
    emergencyFundTarget: 45_000,
    debtOwed: 0,
    dailySpending: Array.from({ length: 30 }, () => 330),
    goals: [{ current: 8_000, target: 10_000 }],
    recurringMonthly: 4_000,
    ...overrides,
  };
}

test('healthy finances score high; the components sum to the score', () => {
  const result = calculateMoneyScore(scoreInput());
  assert.ok(result.score >= 80, `expected >= 80, got ${result.score}`);
  assert.equal(result.grade, 'excellent');

  const summed = result.components.reduce((total, component) => total + component.points, 0);
  assert.equal(Math.round(summed), result.score);
});

test('the score is bounded and every component carries its weight', () => {
  const worst = calculateMoneyScore(
    scoreInput({
      monthlySaved: 0,
      budgetSpent: 30_000,
      emergencyFund: 0,
      debtOwed: 20_000,
      dailySpending: [0, 0, 0, 0, 0, 0, 5_000],
      goals: [{ current: 0, target: 10_000 }],
      recurringMonthly: 14_000,
    }),
  );
  assert.ok(worst.score >= 0 && worst.score <= 20, `expected a low score, got ${worst.score}`);

  const best = calculateMoneyScore(scoreInput({ monthlySaved: 15_000, budgetSpent: 0 }));
  assert.ok(best.score <= 100);

  const totalWeight = best.components.reduce((total, component) => total + component.weight, 0);
  assert.equal(totalWeight, 100);
});

test('savings rate is measured against income, and 20% earns full marks', () => {
  const result = calculateMoneyScore(scoreInput({ monthlySaved: 3_000 }));
  const savings = result.components.find((component) => component.key === 'savings_rate');
  assert.equal(result.savingsRate, 0.2);
  assert.equal(savings?.ratio, 1);
});

test('the weakest component is the one with the most points still on the table', () => {
  const result = calculateMoneyScore(scoreInput({ emergencyFund: 0 }));
  assert.equal(weakestComponent(result)?.key, 'emergency_fund');
});

test('no income does not produce NaN', () => {
  const result = calculateMoneyScore(
    scoreInput({ monthlyIncome: 0, monthlySaved: 0, monthlyExpenses: 0, emergencyFundTarget: 0 }),
  );
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.components.every((component) => Number.isFinite(component.points)));
});

// --- formatting -----------------------------------------------------------

test('amounts are parsed the way people actually type them', () => {
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('1,234.56'), 1234.56);
  assert.equal(parseAmount('1234.56'), 1234.56);
  assert.equal(parseAmount('15 000'), 15000);
  assert.equal(parseAmount('150'), 150);
  assert.ok(Number.isNaN(parseAmount('')));
  assert.ok(Number.isNaN(parseAmount('abc')));
});

test('whole amounts are shown without decimals', () => {
  assert.match(formatMoney(185, 'MDL', 'ro'), /^185\s?L$/);
  assert.match(formatMoney(185.5, 'MDL', 'ro'), /185,50/);
  assert.match(formatMoney(-40, 'MDL', 'ro'), /^−40/);
  assert.match(formatMoney(40, 'MDL', 'ro', { sign: true }), /^\+40/);
});
