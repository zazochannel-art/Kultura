import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ReportsView } from '@/components/reports/reports-view';
import { createClient } from '@/lib/supabase/server';
import type { MonthlyReport } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Rapoarte' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('monthly_reports')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(12);

  return <ReportsView reports={(data ?? []) as MonthlyReport[]} />;
}
