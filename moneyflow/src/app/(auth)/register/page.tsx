import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Cont nou' };

export default async function RegisterPage() {
  const { t } = await getT();

  return (
    <AuthCard
      title={t('auth.register.title')}
      description={t('auth.register.subtitle')}
      footer={
        <span className="text-muted-foreground">
          {t('auth.register.hasAccount')}{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('auth.login.submit')}
          </Link>
        </span>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
