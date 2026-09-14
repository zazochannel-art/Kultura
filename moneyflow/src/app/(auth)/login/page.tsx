import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';
import { Skeleton } from '@/components/ui/skeleton';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Autentificare' };

export default async function LoginPage() {
  const { t } = await getT();

  return (
    <AuthCard
      title={t('auth.login.title')}
      description={t('auth.login.subtitle')}
      footer={
        <span className="text-muted-foreground">
          {t('auth.login.noAccount')}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t('auth.register.submit')}
          </Link>
        </span>
      }
    >
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
