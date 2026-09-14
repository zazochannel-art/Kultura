import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetForm } from '@/components/auth/reset-form';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Parolă nouă' };

export default async function ResetPasswordPage() {
  const { t } = await getT();

  return (
    <AuthCard title={t('auth.reset.title')} description={t('auth.reset.subtitle')}>
      <ResetForm />
    </AuthCard>
  );
}
