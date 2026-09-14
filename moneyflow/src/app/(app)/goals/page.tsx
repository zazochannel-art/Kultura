import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GoalsView } from '@/components/goals/goals-view';
import { createClient } from '@/lib/supabase/server';
import type { Account, Goal } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Obiective' };
export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [goalsRes, accountsRes] = await Promise.all([
    supabase.from('goals').select('*').neq('status', 'archived').order('created_at'),
    supabase.from('accounts').select('*').eq('is_archived', false).order('created_at'),
  ]);

  const goals = ((goalsRes.data ?? []) as Goal[]).map((goal) => ({
    ...goal,
    target_amount: Number(goal.target_amount),
    current_amount: Number(goal.current_amount),
    monthly_contribution: Number(goal.monthly_contribution),
  }));

  return <GoalsView goals={goals} accounts={(accountsRes.data ?? []) as Account[]} />;
}
