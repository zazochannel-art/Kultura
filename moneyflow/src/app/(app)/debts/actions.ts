'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { failure, fieldFailure, success, type ActionResult } from '@/lib/actions/result';
import { optionalDate, positiveAmount, requiredText, shortText, str, uuidField } from '@/lib/actions/validate';

function revalidateDebts() {
  for (const path of ['/dashboard', '/debts', '/afford']) revalidatePath(path);
}

const schema = z.object({
  person_name: requiredText(60),
  amount: positiveAmount,
  direction: z.enum(['i_owe', 'owed_to_me']),
  due_date: optionalDate,
  note: shortText(200),
});

export async function saveDebt(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = schema.safeParse({
    person_name: str(form, 'person_name'),
    amount: str(form, 'amount'),
    direction: str(form, 'direction') || 'i_owe',
    due_date: str(form, 'due_date'),
    note: str(form, 'note'),
  });

  if (!parsed.success) {
    const first = String(parsed.error.issues[0]?.path[0] ?? 'person_name');
    return fieldFailure({ [first]: first === 'amount' ? 'tx.error.amount' : 'common.required' });
  }

  const id = str(form, 'id');

  if (id) {
    if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');
    const { error } = await session.supabase.from('debts').update(parsed.data).eq('id', id);
    if (error) return failure('common.somethingWrong');
  } else {
    const { error } = await session.supabase
      .from('debts')
      .insert({ ...parsed.data, user_id: session.userId });
    if (error) return failure('common.somethingWrong');
  }

  revalidateDebts();
  return success(undefined, 'debts.saved');
}

export async function setDebtStatus(id: string, paid: boolean): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');
  if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');

  const { error } = await session.supabase
    .from('debts')
    .update({ status: paid ? 'paid' : 'open', paid_at: paid ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return failure('common.somethingWrong');

  revalidateDebts();
  return success(undefined, 'debts.saved');
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');
  if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');

  const { error } = await session.supabase.from('debts').delete().eq('id', id);
  if (error) return failure('common.somethingWrong');

  revalidateDebts();
  return success(undefined, 'debts.deleted');
}
