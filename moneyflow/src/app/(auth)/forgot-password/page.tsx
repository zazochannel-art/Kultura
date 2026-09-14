import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotForm } from '@/components/auth/forgot-form';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Resetare parolă' };

export default async function ForgotPasswordPage() {
  const { t } = await getT();

  return (
    <AuthCard
      title={t('auth.forgot.title')}
      description={t('auth.forgot.subtitle')}
      footer={
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          {t('auth.backToLogin')}
        </Link>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
