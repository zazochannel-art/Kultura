'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { failure, success, type ActionResult } from '@/lib/actions/result';
import { str } from '@/lib/actions/validate';
import { addMonths } from '@/lib/finance/period';

const payloadSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  lines: z
    .array(
      z.object({
        categoryId: z.string().uuid(),
        amount: z.number().finite().min(0),
      }),
    )
    .max(60),
});

function revalidateBudgets() {
  for (const path of ['/dashboard', '/budgets', '/analytics']) revalidatePath(path);
}

/** Ensures a budget row exists for the period and returns its id. */
async function ensureBudget(
  supabase: Awaited<ReturnType<typeof requireUser>> extends null ? never : NonNullable<Awaited<ReturnType<typeof requireUser>>>['supabase'],
  userId: string,
  year: number,
  month: number,
  amount: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('budgets')
    .upsert({ user_id: userId, year, month, amount }, { onConflict: 'user_id,year,month' })
    .select('id')
    .single();

  if (error || !data) return null;
  return data.id as string;
}

export async function saveBudget(_prev: ActionResult, form: FormData): Promise<ActionResult> {
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

  const { year, month, lines } = parsed.data;
  const kept = lines.filter((line) => line.amount > 0);
  const total = kept.reduce((sum, line) => sum + line.amount, 0);

  const budgetId = await ensureBudget(session.supabase, session.userId, year, month, total);
  if (!budgetId) return failure('common.somethingWrong');

  // A category set back to zero is a category with no budget, not a zero one.
  const removed = lines.filter((line) => line.amount <= 0).map((line) => line.categoryId);
  if (removed.length > 0) {
    await session.supabase
      .from('budget_categories')
      .delete()
      .eq('budget_id', budgetId)
      .in('category_id', removed);
  }

  if (kept.length > 0) {
    const { error } = await session.supabase.from('budget_categories').upsert(
      kept.map((line) => ({
        user_id: session.userId,
        budget_id: budgetId,
        category_id: line.categoryId,
        amount: line.amount,
      })),
      { onConflict: 'budget_id,category_id' },
    );
    if (error) return failure('common.somethingWrong');
  }

  revalidateBudgets();
  return success(undefined, 'budgets.saved');
}

export async function copyPreviousBudget(year: number, month: number): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const previous = addMonths({ year, month }, -1);

  const { data: source } = await session.supabase
    .from('budgets')
    .select('id, amount, budget_categories(category_id, amount)')
    .eq('year', previous.year)
    .eq('month', previous.month)
    .maybeSingle();

  const lines = (source?.budget_categories ?? []) as Array<{ category_id: string; amount: number }>;
  if (!source || lines.length === 0) return failure('budgets.noPrevious');

  const budgetId = await ensureBudget(
    session.supabase,
    session.userId,
    year,
    month,
    Number(source.amount),
  );
  if (!budgetId) return failure('common.somethingWrong');

  const { error } = await session.supabase.from('budget_categories').upsert(
    lines.map((line) => ({
      user_id: session.userId,
      budget_id: budgetId,
      category_id: line.category_id,
      amount: Number(line.amount),
    })),
    { onConflict: 'budget_id,category_id' },
  );
  if (error) return failure('common.somethingWrong');

  revalidateBudgets();
  return success(undefined, 'budgets.copied');
}
