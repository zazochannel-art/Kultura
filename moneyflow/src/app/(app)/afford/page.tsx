import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AffordView } from '@/components/afford/afford-view';
import { getFinancialSnapshot } from '@/lib/data/snapshot';

export const metadata: Metadata = { title: 'Îmi permit?' };
export const dynamic = 'force-dynamic';

export default async function AffordPage() {
  const snapshot = await getFinancialSnapshot();
  if (!snapshot) redirect('/login');

  return (
    <AffordView
      budget={snapshot.dailyBudget}
      savingsBalance={snapshot.savingsBalance}
      monthlySavingsTarget={snapshot.profile.monthly_savings_target}
      goals={snapshot.goals}
    />
  );
}
