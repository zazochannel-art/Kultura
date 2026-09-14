'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/field';
import { SubmitButton } from '@/components/shared/submit-button';
import { useT } from '@/lib/i18n/context';
import { signIn, type AuthFormState } from '@/app/(auth)/actions';

export function LoginForm() {
  const t = useT();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      <Field label={t('auth.email')} htmlFor="email" error={state.fields?.email && t(state.fields.email)}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nume@exemplu.md"
          aria-invalid={Boolean(state.fields?.email)}
        />
      </Field>

      <Field
        label={t('auth.password')}
        htmlFor="password"
        error={state.fields?.password && t(state.fields.password)}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fields?.password)}
        />
      </Field>

      {state.error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {t(state.error)}
        </p>
      ) : null}

      <SubmitButton className="w-full" size="lg" pendingLabel={t('common.loading')}>
        {t('auth.login.submit')}
      </SubmitButton>

      <div className="text-center">
        <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
          {t('auth.forgot')}
        </Link>
      </div>
    </form>
  );
}
