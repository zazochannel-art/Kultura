import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DebtsView } from '@/components/debts/debts-view';
import { createClient } from '@/lib/supabase/server';
import type { Debt } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Datorii' };
export const dynamic = 'force-dynamic';

export default async function DebtsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('debts')
    .select('*')
    .order('status')
    .order('due_date', { nullsFirst: false });

  const debts = ((data ?? []) as Debt[]).map((debt) => ({ ...debt, amount: Number(debt.amount) }));

  return <DebtsView debts={debts} />;
}
