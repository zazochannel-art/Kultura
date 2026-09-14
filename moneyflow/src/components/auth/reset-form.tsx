'use client';

import { useActionState } from 'react';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/field';
import { SubmitButton } from '@/components/shared/submit-button';
import { useT } from '@/lib/i18n/context';
import { updatePassword, type AuthFormState } from '@/app/(auth)/actions';

export function ResetForm() {
  const t = useT();
  const [state, action] = useActionState<AuthFormState, FormData>(updatePassword, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label={t('settings.newPassword')}
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
        {t('auth.reset.submit')}
      </SubmitButton>
    </form>
  );
}
