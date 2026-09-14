'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { failure, fieldFailure, success, type ActionResult } from '@/lib/actions/result';
import { hexColor, nonNegativeAmount, requiredText, str, uuidField } from '@/lib/actions/validate';
import { LANGUAGE_COOKIE } from '@/lib/i18n';

const YEAR = 60 * 60 * 24 * 365;

function revalidateEverything() {
  revalidatePath('/', 'layout');
}

// --- profile ---------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().trim().max(60).transform((value) => (value === '' ? null : value)),
  monthly_income: nonNegativeAmount,
  monthly_savings_target: nonNegativeAmount,
  emergency_fund_target: nonNegativeAmount,
  payday_day: z.coerce.number().int().min(1).max(31),
});

export async function updateProfile(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = profileSchema.safeParse({
    name: str(form, 'name'),
    monthly_income: str(form, 'monthly_income') || '0',
    monthly_savings_target: str(form, 'monthly_savings_target') || '0',
    emergency_fund_target: str(form, 'emergency_fund_target') || '0',
    payday_day: str(form, 'payday_day') || '1',
  });

  if (!parsed.success) return fieldFailure({ name: 'common.required' });

  const { error } = await session.supabase
    .from('profiles')
    .update(parsed.data)
    .eq('user_id', session.userId);

  if (error) return failure('common.somethingWrong');

  revalidateEverything();
  return success(undefined, 'settings.saved');
}

// --- preferences -----------------------------------------------------------

const preferencesSchema = z.object({
  currency: z.enum(['MDL', 'EUR', 'USD', 'RON']),
  language: z.enum(['ro', 'ru', 'en']),
  theme: z.enum(['dark', 'light']),
});

export async function updatePreferences(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = preferencesSchema.safeParse({
    currency: str(form, 'currency'),
    language: str(form, 'language'),
    theme: str(form, 'theme'),
  });

  if (!parsed.success) return failure('common.somethingWrong');

  const { error } = await session.supabase
    .from('profiles')
    .update(parsed.data)
    .eq('user_id', session.userId);

  if (error) return failure('common.somethingWrong');

  // Cookies too, so the very next server render already uses the new language
  // and theme — including the `<html class>` the root layout sets.
  const store = await cookies();
  store.set(LANGUAGE_COOKIE, parsed.data.language, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  store.set('mf_theme', parsed.data.theme, { path: '/', maxAge: YEAR, sameSite: 'lax' });

  revalidateEverything();
  return success(undefined, 'settings.saved');
}

// --- security --------------------------------------------------------------

export async function changePassword(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const password = str(form, 'password');
  const confirm = str(form, 'passwordConfirm');

  if (password.length < 8) return fieldFailure({ password: 'auth.error.passwordShort' });
  if (password !== confirm) return fieldFailure({ passwordConfirm: 'auth.error.passwordMismatch' });

  const { error } = await session.supabase.auth.updateUser({ password });
  if (error) return failure('common.somethingWrong');

  return success(undefined, 'auth.reset.done');
}

// --- categories ------------------------------------------------------------

const categorySchema = z.object({
  name: requiredText(40),
  icon: z.string().trim().max(40).default('Circle'),
  color: hexColor,
  kind: z.enum(['income', 'expense', 'both']),
});

export async function saveCategory(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = categorySchema.safeParse({
    name: str(form, 'name'),
    icon: str(form, 'icon') || 'Circle',
    color: str(form, 'color') || '#71717A',
    kind: str(form, 'kind') || 'expense',
  });

  if (!parsed.success) return fieldFailure({ name: 'common.required' });

  const id = str(form, 'id');

  const query = id
    ? session.supabase.from('categories').update(parsed.data).eq('id', id)
    : session.supabase.from('categories').insert({ ...parsed.data, user_id: session.userId });

  const { error } = await query;

  if (error) {
    // The (user_id, lower(name)) unique index is the only realistic failure.
    return error.code === '23505'
      ? fieldFailure({ name: 'categories.duplicate' })
      : failure('common.somethingWrong');
  }

  revalidateEverything();
  return success(undefined, 'categories.saved');
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');
  if (!uuidField.safeParse(id).success) return failure('common.somethingWrong');

  const { error } = await session.supabase.from('categories').delete().eq('id', id);
  if (error) return failure('common.somethingWrong');

  revalidateEverything();
  return success(undefined, 'categories.deleted');
}

// --- demo data -------------------------------------------------------------

export async function loadDemoData(): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const { error } = await session.supabase.rpc('mf_seed_demo_data');
  if (error) return failure('common.somethingWrong');

  revalidateEverything();
  return success(undefined, 'settings.demoLoaded');
}

export async function clearDemoData(): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const { error } = await session.supabase.rpc('mf_clear_demo_data');
  if (error) return failure('common.somethingWrong');

  revalidateEverything();
  return success(undefined, 'settings.demoCleared');
}

// --- account deletion ------------------------------------------------------

export async function deleteAccountForever(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  // The typed keyword is the confirmation; every locale's word is accepted so a
  // language switch cannot lock someone out of deleting their own account.
  const typed = str(form, 'confirm').trim().toUpperCase();
  if (!['ȘTERGE', 'STERGE', 'УДАЛИТЬ', 'DELETE'].includes(typed)) {
    return fieldFailure({ confirm: 'common.required' });
  }

  const { error } = await session.supabase.rpc('mf_delete_account');
  if (error) return failure('common.somethingWrong');

  await session.supabase.auth.signOut();
  revalidateEverything();
  redirect('/login');
}
