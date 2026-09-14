'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { failure, fieldFailure, success, type ActionResult } from '@/lib/actions/result';
import { amountField, bool, hexColor, requiredText, str, uuidField } from '@/lib/actions/validate';

const schema = z.object({
  name: requiredText(40),
  type: z.enum(['cash', 'bank', 'card', 'savings']),
  currency: z.enum(['MDL', 'EUR', 'USD', 'RON']),
  balance: amountField,
  color: hexColor,
  include_in_total: z.boolean(),
});

function parse(form: FormData) {
  return schema.safeParse({
    name: str(form, 'name'),
    type: str(form, 'type'),
    currency: str(form, 'currency') || 'MDL',
    balance: str(form, 'balance') || '0',
    color: str(form, 'color') || '#06B6D4',
    include_in_total: bool(form, 'include_in_total'),
  });
}

function revalidateAll() {
  for (const path of ['/dashboard', '/accounts', '/transactions', '/analytics']) {
    revalidatePath(path);
  }
}

export async function saveAccount(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = parse(form);
  if (!parsed.success) return fieldFailure({ name: 'common.required' });

  const id = str(form, 'id');
  const input = parsed.data;

  if (id) {
    if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');
    const { error } = await session.supabase
      .from('accounts')
      .update({
        name: input.name,
        type: input.type,
        currency: input.currency,
        balance: input.balance,
        color: input.color,
        include_in_total: input.include_in_total,
      })
      .eq('id', id);
    if (error) return failure('common.somethingWrong');
  } else {
    const { error } = await session.supabase.from('accounts').insert({
      user_id: session.userId,
      name: input.name,
      type: input.type,
      currency: input.currency,
      // The balance entered on a new account is money that existed before
      // MONEYFLOW; transaction triggers move it from there.
      balance: input.balance,
      color: input.color,
      include_in_total: input.include_in_total,
    });
    if (error) return failure('common.somethingWrong');
  }

  revalidateAll();
  return success(undefined, 'accounts.saved');
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');
  if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');

  const { error } = await session.supabase.from('accounts').delete().eq('id', id);
  if (error) return failure('common.somethingWrong');

  revalidateAll();
  return success(undefined, 'accounts.deleted');
}

export async function toggleArchiveAccount(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');
  if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');

  const { error } = await session.supabase
    .from('accounts')
    .update({ is_archived: archived })
    .eq('id', id);
  if (error) return failure('common.somethingWrong');

  revalidateAll();
  return success(undefined, 'accounts.saved');
}
