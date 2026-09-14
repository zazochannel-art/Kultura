'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { failure, fieldFailure, success, type ActionResult } from '@/lib/actions/result';
import { dateField, optionalUuid, positiveAmount, shortText, str, uuidField } from '@/lib/actions/validate';

const APP_PATHS = [
  '/dashboard',
  '/transactions',
  '/accounts',
  '/budgets',
  '/analytics',
  '/afford',
  '/goals',
];

function revalidateMoney() {
  for (const path of APP_PATHS) revalidatePath(path);
}

const baseSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: positiveAmount,
  account_id: uuidField,
  to_account_id: optionalUuid,
  category_id: optionalUuid,
  date: dateField,
  description: shortText(120),
  notes: shortText(500),
});

function parse(form: FormData) {
  return baseSchema.safeParse({
    type: str(form, 'type'),
    amount: str(form, 'amount'),
    account_id: str(form, 'account_id'),
    to_account_id: str(form, 'to_account_id'),
    category_id: str(form, 'category_id'),
    date: str(form, 'date'),
    description: str(form, 'description'),
    notes: str(form, 'notes'),
  });
}

/** Turns a zod failure into the field errors the form renders. */
function fieldErrors(issues: z.core.$ZodIssue[]) {
  const fields: Record<string, 'tx.error.amount' | 'tx.error.account' | 'tx.error.date' | 'common.required'> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key === 'amount') fields.amount = 'tx.error.amount';
    else if (key === 'account_id') fields.account_id = 'tx.error.account';
    else if (key === 'date') fields.date = 'tx.error.date';
    else fields[key] = 'common.required';
  }
  return fields;
}

export async function createTransaction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = parse(form);
  if (!parsed.success) return fieldFailure(fieldErrors(parsed.error.issues));

  const input = parsed.data;

  if (input.type === 'transfer') {
    if (!input.to_account_id) return fieldFailure({ to_account_id: 'tx.error.account' });
    if (input.to_account_id === input.account_id) {
      return fieldFailure({ to_account_id: 'tx.error.sameAccount' });
    }
  }

  const { error } = await session.supabase.from('transactions').insert({
    user_id: session.userId,
    type: input.type,
    amount: input.amount,
    account_id: input.account_id,
    to_account_id: input.type === 'transfer' ? input.to_account_id : null,
    category_id: input.type === 'transfer' ? null : input.category_id,
    date: input.date,
    description: input.description,
    notes: input.notes,
  });

  if (error) return failure('common.somethingWrong');

  revalidateMoney();
  return success(undefined, 'tx.saved');
}

export async function updateTransaction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const id = uuidField.safeParse(str(form, 'id'));
  if (!id.success) return failure('common.somethingWrong');

  const parsed = parse(form);
  if (!parsed.success) return fieldFailure(fieldErrors(parsed.error.issues));

  const input = parsed.data;

  if (input.type === 'transfer') {
    if (!input.to_account_id) return fieldFailure({ to_account_id: 'tx.error.account' });
    if (input.to_account_id === input.account_id) {
      return fieldFailure({ to_account_id: 'tx.error.sameAccount' });
    }
  }

  const { error } = await session.supabase
    .from('transactions')
    .update({
      type: input.type,
      amount: input.amount,
      account_id: input.account_id,
      to_account_id: input.type === 'transfer' ? input.to_account_id : null,
      category_id: input.type === 'transfer' ? null : input.category_id,
      date: input.date,
      description: input.description,
      notes: input.notes,
    })
    .eq('id', id.data);

  if (error) return failure('common.somethingWrong');

  revalidateMoney();
  return success(undefined, 'tx.updated');
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');

  const { error } = await session.supabase.from('transactions').delete().eq('id', id);
  if (error) return failure('common.somethingWrong');

  revalidateMoney();
  return success(undefined, 'tx.deleted');
}
