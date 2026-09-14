/**
 * Money Score — one 0-100 number from seven things that actually move a
 * household's finances. Every component carries its own weight, its own
 * verdict, and the single change that would raise it, because a score with no
 * "so what" is just decoration.
 */

export type ScoreKey =
  | 'savings_rate'
  | 'budget_adherence'
  | 'emergency_fund'
  | 'debt_level'
  | 'spending_consistency'
  | 'goal_progress'
  | 'recurring_load';

export interface ScoreComponent {
  key: ScoreKey;
  /** 0-1 */
  ratio: number;
  weight: number;
  points: number;
  /** Raw measured value, for the explanation text. */
  value: number;
  level: 'good' | 'ok' | 'poor';
}

export interface MoneyScoreInput {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySaved: number;
  budgetTotal: number | null;
  budgetSpent: number;
  /** Liquid money set aside for emergencies. */
  emergencyFund: number;
  emergencyFundTarget: number;
  /** Outstanding debt the user owes. */
  debtOwed: number;
  /** Daily expense totals for the last 30 days, oldest first. */
  dailySpending: number[];
  goals: Array<{ current: number; target: number }>;
  /** Monthly total of active recurring expenses. */
  recurringMonthly: number;
}

export interface MoneyScoreResult {
  score: number;
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  components: ScoreComponent[];
  savingsRate: number;
}

const WEIGHTS: Record<ScoreKey, number> = {
  savings_rate: 22,
  budget_adherence: 18,
  emergency_fund: 16,
  debt_level: 14,
  spending_consistency: 10,
  goal_progress: 10,
  recurring_load: 10,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function level(ratio: number): ScoreComponent['level'] {
  if (ratio >= 0.75) return 'good';
  if (ratio >= 0.45) return 'ok';
  return 'poor';
}

function component(key: ScoreKey, ratio: number, value: number): ScoreComponent {
  const bounded = clamp01(ratio);
  return {
    key,
    ratio: bounded,
    weight: WEIGHTS[key],
    points: Math.round(bounded * WEIGHTS[key] * 10) / 10,
    value,
    level: level(bounded),
  };
}

export function calculateMoneyScore(input: MoneyScoreInput): MoneyScoreResult {
  const income = Math.max(0, input.monthlyIncome);

  // Savings rate: 20% of income saved is full marks.
  const savingsRate = income > 0 ? input.monthlySaved / income : 0;
  const savings = component('savings_rate', savingsRate / 0.2, savingsRate);

  // Budget adherence: staying at or under the budget is full marks; the score
  // falls away as spending runs past it. No budget set is treated as neutral.
  let adherenceRatio: number;
  if (input.budgetTotal === null || input.budgetTotal <= 0) {
    adherenceRatio = 0.5;
  } else {
    const used = input.budgetSpent / input.budgetTotal;
    adherenceRatio = used <= 1 ? 1 : Math.max(0, 1 - (used - 1) * 2);
  }
  const adherence = component('budget_adherence', adherenceRatio, input.budgetSpent);

  // Emergency fund: the profile target, or three months of expenses.
  const efTarget =
    input.emergencyFundTarget > 0
      ? input.emergencyFundTarget
      : Math.max(input.monthlyExpenses, income) * 3;
  const emergency = component(
    'emergency_fund',
    efTarget > 0 ? input.emergencyFund / efTarget : 0,
    input.emergencyFund,
  );

  // Debt: nothing owed is full marks, and it is gone once debt reaches half a
  // month's income.
  const debtRatio = income > 0 ? input.debtOwed / (income * 0.5) : input.debtOwed > 0 ? 1 : 0;
  const debt = component('debt_level', 1 - debtRatio, input.debtOwed);

  // Consistency: how steady daily spending is, as 1 - (stddev / mean).
  const days = input.dailySpending.filter((d) => Number.isFinite(d));
  let consistencyRatio = 0.5;
  let variation = 0;
  if (days.length >= 7) {
    const mean = days.reduce((a, b) => a + b, 0) / days.length;
    if (mean > 0) {
      const variance = days.reduce((acc, d) => acc + (d - mean) ** 2, 0) / days.length;
      variation = Math.sqrt(variance) / mean;
      consistencyRatio = 1 - variation / 1.5;
    } else {
      consistencyRatio = 1;
    }
  }
  const consistency = component('spending_consistency', consistencyRatio, variation);

  // Goals: average completion across active goals.
  const goalRatios = input.goals
    .filter((g) => g.target > 0)
    .map((g) => clamp01(g.current / g.target));
  const goalAvg =
    goalRatios.length > 0 ? goalRatios.reduce((a, b) => a + b, 0) / goalRatios.length : 0.5;
  const goals = component('goal_progress', goalAvg, goalAvg);

  // Recurring load: committed spending at or under 35% of income is healthy.
  const load = income > 0 ? input.recurringMonthly / income : input.recurringMonthly > 0 ? 1 : 0;
  const recurringRatio = load <= 0.35 ? 1 : Math.max(0, 1 - (load - 0.35) / 0.35);
  const recurring = component('recurring_load', recurringRatio, load);

  const components = [savings, adherence, emergency, debt, consistency, goals, recurring];
  const score = Math.round(components.reduce((acc, c) => acc + c.points, 0));

  let grade: MoneyScoreResult['grade'];
  if (score >= 80) grade = 'excellent';
  else if (score >= 65) grade = 'good';
  else if (score >= 45) grade = 'fair';
  else grade = 'poor';

  return { score: Math.min(100, Math.max(0, score)), grade, components, savingsRate };
}

/**
 * The component with the most points still on the table — the one worth acting
 * on first.
 */
export function weakestComponent(result: MoneyScoreResult): ScoreComponent | null {
  const sorted = [...result.components].sort(
    (a, b) => (b.weight - b.points) - (a.weight - a.points),
  );
  return sorted[0] ?? null;
}
