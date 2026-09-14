'use client';

import { useActionState } from 'react';
import { MailCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/field';
import { SubmitButton } from '@/components/shared/submit-button';
import { useT } from '@/lib/i18n/context';
import { requestPasswordReset, type AuthFormState } from '@/app/(auth)/actions';

export function ForgotForm() {
  const t = useT();
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});

  if (state.message) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">{t(state.message)}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
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

      {state.error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {t(state.error)}
        </p>
      ) : null}

      <SubmitButton className="w-full" size="lg" pendingLabel={t('common.loading')}>
        {t('auth.forgot.submit')}
      </SubmitButton>
    </form>
  );
}
