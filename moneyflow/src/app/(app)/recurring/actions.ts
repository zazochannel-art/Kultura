'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { failure, fieldFailure, success, type ActionResult } from '@/lib/actions/result';
import {
  dateField,
  optionalDate,
  optionalUuid,
  positiveAmount,
  requiredText,
  str,
  uuidField,
} from '@/lib/actions/validate';

function revalidateRecurring() {
  for (const path of ['/dashboard', '/recurring', '/transactions', '/afford']) revalidatePath(path);
}

const schema = z.object({
  name: requiredText(60),
  amount: positiveAmount,
  type: z.enum(['income', 'expense']),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  next_date: dateField,
  end_date: optionalDate,
  category_id: optionalUuid,
  account_id: optionalUuid,
});

export async function saveRecurring(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = schema.safeParse({
    name: str(form, 'name'),
    amount: str(form, 'amount'),
    type: str(form, 'type') || 'expense',
    frequency: str(form, 'frequency') || 'monthly',
    next_date: str(form, 'next_date'),
    end_date: str(form, 'end_date'),
    category_id: str(form, 'category_id'),
    account_id: str(form, 'account_id'),
  });

  if (!parsed.success) {
    const first = String(parsed.error.issues[0]?.path[0] ?? 'name');
    return fieldFailure({
      [first]: first === 'amount' ? 'tx.error.amount' : first === 'next_date' ? 'tx.error.date' : 'common.required',
    });
  }

  const id = str(form, 'id');

  if (id) {
    if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');
    const { error } = await session.supabase.from('recurring_transactions').update(parsed.data).eq('id', id);
    if (error) return failure('common.somethingWrong');
  } else {
    const { error } = await session.supabase
      .from('recurring_transactions')
      .insert({ ...parsed.data, user_id: session.userId });
    if (error) return failure('common.somethingWrong');
  }

  revalidateRecurring();
  return success(undefined, 'recurring.saved');
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');
  if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');

  const { error } = await session.supabase.from('recurring_transactions').delete().eq('id', id);
  if (error) return failure('common.somethingWrong');

  revalidateRecurring();
  return success(undefined, 'recurring.deleted');
}

export async function toggleRecurring(id: string, active: boolean): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');
  if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');

  const { error } = await session.supabase
    .from('recurring_transactions')
    .update({ is_active: active })
    .eq('id', id);
  if (error) return failure('common.somethingWrong');

  revalidateRecurring();
  return success(undefined, 'recurring.saved');
}
