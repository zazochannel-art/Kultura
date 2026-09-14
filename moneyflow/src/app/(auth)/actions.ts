'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/supabase/env';
import type { TranslationKey } from '@/lib/i18n';

export interface AuthFormState {
  error?: TranslationKey;
  message?: TranslationKey;
  fields?: Partial<Record<'email' | 'password' | 'passwordConfirm' | 'name', TranslationKey>>;
}

const emailSchema = z.string().trim().min(3).max(320).email();
const passwordSchema = z.string().min(8).max(128);

/** Supabase error text is not a stable contract; match loosely, fail closed. */
function mapAuthError(message: string): TranslationKey {
  const lower = message.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'auth.error.emailTaken';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) return 'auth.error.rateLimit';
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'auth.error.credentials';
  }
  if (lower.includes('email')) return 'auth.error.emailInvalid';
  return 'common.somethingWrong';
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/dashboard');

  if (!emailSchema.safeParse(email).success) {
    return { fields: { email: 'auth.error.emailInvalid' } };
  }
  if (!password) return { fields: { password: 'common.required' } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

  if (error) return { error: mapAuthError(error.message) };

  revalidatePath('/', 'layout');
  redirect(next.startsWith('/') ? next : '/dashboard');
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('passwordConfirm') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (!emailSchema.safeParse(email).success) {
    return { fields: { email: 'auth.error.emailInvalid' } };
  }
  if (!passwordSchema.safeParse(password).success) {
    return { fields: { password: 'auth.error.passwordShort' } };
  }
  if (password !== confirm) {
    return { fields: { passwordConfirm: 'auth.error.passwordMismatch' } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { name: name || null },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) return { error: mapAuthError(error.message) };

  // With email confirmation off, sign-up returns a session and the user goes
  // straight to onboarding. With it on, they have mail to read first.
  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/onboarding');
  }

  return { message: 'auth.register.checkEmail' };
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');

  if (!emailSchema.safeParse(email).success) {
    return { fields: { email: 'auth.error.emailInvalid' } };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });

  // Always the same answer, so this cannot be used to discover which addresses
  // have accounts.
  return { message: 'auth.forgot.sent' };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('passwordConfirm') ?? '');

  if (!passwordSchema.safeParse(password).success) {
    return { fields: { password: 'auth.error.passwordShort' } };
  }
  if (password !== confirm) {
    return { fields: { passwordConfirm: 'auth.error.passwordMismatch' } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth.error.session' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: mapAuthError(error.message) };

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
