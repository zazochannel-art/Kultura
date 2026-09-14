'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { failure, type ActionResult } from '@/lib/actions/result';
import { str } from '@/lib/actions/validate';
import { currentMonth, toDateOnly } from '@/lib/finance/period';
import type { Category } from '@/lib/types/database';

const fixedExpenseSchema = z.object({
  name: z.string().trim().min(1).max(60),
  amount: z.number().finite().positive(),
  categoryId: z.string().uuid().nullable().optional(),
});

const goalSchema = z.object({
  name: z.string().trim().min(1).max(60),
  target: z.number().finite().positive(),
  icon: z.string().trim().min(1).max(40).default('Target'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#8B5CF6'),
});

const payloadSchema = z.object({
  currency: z.enum(['MDL', 'EUR', 'USD', 'RON']),
  income: z.number().finite().min(0),
  paydayDay: z.number().int().min(1).max(31),
  savingsTarget: z.number().finite().min(0),
  emergencyTarget: z.number().finite().min(0),
  fixedExpenses: z.array(fixedExpenseSchema).max(20),
  goals: z.array(goalSchema).max(10),
});

/**
 * Default split of what is left after fixed costs and savings.
 *
 * The point of generating a budget at the end of onboarding is that the user
 * lands on a dashboard that already knows what it is talking about. These
 * weights are a starting position, visible and editable on /budgets from the
 * first minute — not a claim about how anyone should live.
 */
const DEFAULT_SPLIT: Array<{ name: string; share: number }> = [
  { name: 'Food', share: 0.35 },
  { name: 'Car', share: 0.15 },
  { name: 'Shopping', share: 0.15 },
  { name: 'Entertainment', share: 0.1 },
  { name: 'Health', share: 0.05 },
  { name: 'Clothing', share: 0.05 },
  { name: 'Other', share: 0.15 },
];

export async function completeOnboarding(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  let raw: unknown;
  try {
    raw = JSON.parse(str(form, 'payload'));
  } catch {
    return failure('common.somethingWrong');
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return failure('common.somethingWrong');

  const input = parsed.data;
  const { supabase, userId } = session;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      currency: input.currency,
      monthly_income: input.income,
      payday_day: input.paydayDay,
      monthly_savings_target: input.savingsTarget,
      emergency_fund_target: input.emergencyTarget,
      onboarding_completed: true,
    })
    .eq('user_id', userId);

  if (profileError) return failure('common.somethingWrong');

  const [{ data: categoryRows }, { data: accountRows }] = await Promise.all([
    supabase.from('categories').select('id, name'),
    supabase.from('accounts').select('id').eq('is_archived', false).order('created_at').limit(1),
  ]);

  const categories = (categoryRows ?? []) as Pick<Category, 'id' | 'name'>[];
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const accountId = (accountRows ?? [])[0]?.id ?? null;

  // --- fixed expenses become recurring charges ------------------------------

  if (input.fixedExpenses.length > 0) {
    const month = currentMonth();
    // First of next month: this month's rent has usually been paid already, and
    // posting it again on day one would be wrong in the user's favour.
    const nextDate = toDateOnly(new Date(month.year, month.month, 1));

    const rows = input.fixedExpenses.map((expense) => ({
      user_id: userId,
      name: expense.name,
      amount: expense.amount,
      type: 'expense' as const,
      frequency: 'monthly' as const,
      next_date: nextDate,
      category_id: expense.categoryId ?? byName.get('bills') ?? null,
      account_id: accountId,
      is_fixed: true,
    }));

    await supabase.from('recurring_transactions').insert(rows);
  }

  // --- goals ----------------------------------------------------------------

  if (input.goals.length > 0) {
    const monthly =
      input.goals.length > 0 ? Math.round(input.savingsTarget / input.goals.length) : 0;

    await supabase.from('goals').insert(
      input.goals.map((goal) => ({
        user_id: userId,
        name: goal.name,
        target_amount: goal.target,
        icon: goal.icon,
        color: goal.color,
        monthly_contribution: monthly,
      })),
    );
  }

  // --- the first monthly budget --------------------------------------------

  const fixedTotal = input.fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const discretionary = Math.max(0, input.income - fixedTotal - input.savingsTarget);
  const month = currentMonth();

  const { data: budget } = await supabase
    .from('budgets')
    .upsert(
      {
        user_id: userId,
        year: month.year,
        month: month.month,
        amount: discretionary + fixedTotal,
      },
      { onConflict: 'user_id,year,month' },
    )
    .select('id')
    .single();

  if (budget && discretionary > 0) {
    const lines = DEFAULT_SPLIT.map((slice) => {
      const categoryId = byName.get(slice.name.toLowerCase());
      if (!categoryId) return null;
      return {
        user_id: userId,
        budget_id: budget.id as string,
        category_id: categoryId,
        amount: Math.round(discretionary * slice.share),
      };
    }).filter((line): line is NonNullable<typeof line> => line !== null);

    if (lines.length > 0) {
      await supabase.from('budget_categories').upsert(lines, { onConflict: 'budget_id,category_id' });
    }
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/** Lets someone skip the questions and land on a usable, if empty, dashboard. */
export async function skipOnboarding(): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  await session.supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('user_id', session.userId);

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
