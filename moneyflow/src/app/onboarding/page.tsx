import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { I18nProvider } from '@/lib/i18n/context';
import { getLanguage, getT } from '@/lib/i18n/server';
import type { Category, Profile } from '@/lib/types/database';
import { OnboardingFlow } from './onboarding-flow';

export const metadata: Metadata = { title: 'Configurare' };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [profileRes, categoriesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('categories').select('*').order('sort_order'),
  ]);

  const profile = profileRes.data as Profile | null;
  if (!profile) redirect('/setup-required');
  if (profile.onboarding_completed) redirect('/dashboard');

  const { t } = await getT(profile.language);
  const lang = await getLanguage(profile.language);

  return (
    <I18nProvider lang={lang} currency={profile.currency}>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Wallet className="size-5" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold">{t('onboarding.welcome')}</h1>
          <p className="max-w-sm text-sm text-muted-foreground">{t('onboarding.welcomeBody')}</p>
        </div>

        <OnboardingFlow categories={(categoriesRes.data ?? []) as Category[]} />
      </main>
    </I18nProvider>
  );
}
