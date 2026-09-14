'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { failure, fieldFailure, success, type ActionResult } from '@/lib/actions/result';
import {
  hexColor,
  nonNegativeAmount,
  optionalDate,
  optionalUuid,
  positiveAmount,
  requiredText,
  shortText,
  str,
  uuidField,
} from '@/lib/actions/validate';
import { toDateOnly } from '@/lib/finance/period';

function revalidateGoals() {
  for (const path of ['/dashboard', '/goals', '/afford', '/analytics']) revalidatePath(path);
}

const goalSchema = z.object({
  name: requiredText(60),
  icon: z.string().trim().max(40).default('Target'),
  color: hexColor,
  target_amount: positiveAmount,
  monthly_contribution: nonNegativeAmount,
  deadline: optionalDate,
});

export async function saveGoal(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = goalSchema.safeParse({
    name: str(form, 'name'),
    icon: str(form, 'icon') || 'Target',
    color: str(form, 'color') || '#8B5CF6',
    target_amount: str(form, 'target_amount'),
    monthly_contribution: str(form, 'monthly_contribution') || '0',
    deadline: str(form, 'deadline'),
  });

  if (!parsed.success) {
    const first = String(parsed.error.issues[0]?.path[0] ?? 'name');
    return fieldFailure({ [first]: first === 'target_amount' ? 'tx.error.amount' : 'common.required' });
  }

  const id = str(form, 'id');
  const input = parsed.data;

  if (id) {
    if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');
    const { error } = await session.supabase.from('goals').update(input).eq('id', id);
    if (error) return failure('common.somethingWrong');
  } else {
    const { error } = await session.supabase
      .from('goals')
      .insert({ ...input, user_id: session.userId });
    if (error) return failure('common.somethingWrong');
  }

  revalidateGoals();
  return success(undefined, 'goals.saved');
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');
  if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');

  const { error } = await session.supabase.from('goals').delete().eq('id', id);
  if (error) return failure('common.somethingWrong');

  revalidateGoals();
  return success(undefined, 'goals.deleted');
}

const contributionSchema = z.object({
  goal_id: uuidField,
  amount: positiveAmount,
  account_id: optionalUuid,
  note: shortText(120),
});

/**
 * Records money going into a goal. When an account is named the money also
 * moves: a contribution that leaves the balance untouched would quietly
 * overstate what is left to spend.
 */
export async function addContribution(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = contributionSchema.safeParse({
    goal_id: str(form, 'goal_id'),
    amount: str(form, 'amount'),
    account_id: str(form, 'account_id'),
    note: str(form, 'note'),
  });

  if (!parsed.success) return fieldFailure({ amount: 'tx.error.amount' });

  const input = parsed.data;
  const today = toDateOnly(new Date());

  const { error } = await session.supabase.from('goal_contributions').insert({
    user_id: session.userId,
    goal_id: input.goal_id,
    account_id: input.account_id,
    amount: input.amount,
    date: today,
    note: input.note,
  });

  if (error) return failure('common.somethingWrong');

  if (input.account_id) {
    const { data: savingsAccount } = await session.supabase
      .from('accounts')
      .select('id')
      .eq('type', 'savings')
      .eq('is_archived', false)
      .neq('id', input.account_id)
      .limit(1)
      .maybeSingle();

    if (savingsAccount) {
      // A savings account exists, so this is a real transfer between accounts.
      await session.supabase.from('transactions').insert({
        user_id: session.userId,
        account_id: input.account_id,
        to_account_id: savingsAccount.id,
        type: 'transfer',
        amount: input.amount,
        description: input.note,
        goal_id: input.goal_id,
        date: today,
      });
    }
  }

  revalidateGoals();
  return success(undefined, 'goals.contributed');
}
