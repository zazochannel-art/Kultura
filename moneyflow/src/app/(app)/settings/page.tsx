import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SettingsView } from '@/components/settings/settings-view';
import { createClient } from '@/lib/supabase/server';
import type { Category, Profile } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Setări' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, categoriesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('categories').select('*').order('sort_order').order('name'),
  ]);

  const profile = profileRes.data as Profile | null;
  if (!profile) redirect('/setup-required');

  return (
    <SettingsView
      profile={{
        ...profile,
        monthly_income: Number(profile.monthly_income),
        monthly_savings_target: Number(profile.monthly_savings_target),
        emergency_fund_target: Number(profile.emergency_fund_target),
      }}
      categories={(categoriesRes.data ?? []) as Category[]}
      email={user.email ?? ''}
    />
  );
}
