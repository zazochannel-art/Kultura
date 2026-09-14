import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountsView } from '@/components/accounts/accounts-view';
import { createClient } from '@/lib/supabase/server';
import type { Account, Profile } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Conturi' };
export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [accountsRes, profileRes] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('profiles').select('currency').eq('user_id', user.id).maybeSingle(),
  ]);

  const all = ((accountsRes.data ?? []) as Account[]).map((a) => ({ ...a, balance: Number(a.balance) }));
  const currency = (profileRes.data as Pick<Profile, 'currency'> | null)?.currency ?? 'MDL';

  return (
    <AccountsView
      accounts={all.filter((a) => !a.is_archived)}
      archived={all.filter((a) => a.is_archived)}
      currency={currency}
    />
  );
}
