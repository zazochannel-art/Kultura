import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { createClient } from '@/lib/supabase/server';
import { getLanguage } from '@/lib/i18n/server';
import { getNotifications } from '@/lib/data/notifications';
import type { Account, Category, Profile } from '@/lib/types/database';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [profileRes, accountsRes, categoriesRes, notifications] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('accounts').select('*').eq('is_archived', false).order('created_at'),
    supabase.from('categories').select('*').order('sort_order').order('name'),
    getNotifications(),
  ]);

  const profile = profileRes.data as Profile | null;

  // The bootstrap trigger creates the profile with the auth user, so a missing
  // one means the database has not been migrated yet — say so rather than
  // rendering an app with nothing behind it.
  if (!profile) redirect('/setup-required');
  if (!profile.onboarding_completed) redirect('/onboarding');

  return (
    <AppShell
      lang={await getLanguage(profile.language)}
      currency={profile.currency}
      name={profile.name}
      email={user.email ?? ''}
      accounts={(accountsRes.data ?? []) as Account[]}
      categories={(categoriesRes.data ?? []) as Category[]}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
