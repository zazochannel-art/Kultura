'use client';

import { useActionState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/field';
import { SubmitButton } from '@/components/shared/submit-button';
import { useT } from '@/lib/i18n/context';
import { signUp, type AuthFormState } from '@/app/(auth)/actions';

export function RegisterForm() {
  const t = useT();
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, {});

  if (state.message) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-success/15 text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">{t(state.message)}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label={t('auth.name')} htmlFor="name">
        <Input id="name" name="name" autoComplete="name" placeholder="Ion Popescu" />
      </Field>

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
        hint={t('auth.error.passwordShort')}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fields?.password)}
        />
      </Field>

      <Field
        label={t('auth.passwordConfirm')}
        htmlFor="passwordConfirm"
        error={state.fields?.passwordConfirm && t(state.fields.passwordConfirm)}
      >
        <Input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fields?.passwordConfirm)}
        />
      </Field>

      {state.error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {t(state.error)}
        </p>
      ) : null}

      <SubmitButton className="w-full" size="lg" pendingLabel={t('common.loading')}>
        {t('auth.register.submit')}
      </SubmitButton>
    </form>
  );
}
