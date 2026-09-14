import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BudgetsView, type BudgetRow } from '@/components/budgets/budgets-view';
import { createClient } from '@/lib/supabase/server';
import { currentMonth, monthRange } from '@/lib/finance/period';
import type { BudgetCategory, Category, Profile, Transaction } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Bugete' };
export const dynamic = 'force-dynamic';

function parseMonthParam(value: string | undefined) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (!match) return currentMonth();
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return currentMonth();
  return { year, month };
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const monthParam = Array.isArray(params.month) ? params.month[0] : params.month;
  const ref = parseMonthParam(monthParam);
  const { from, to } = monthRange(ref);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [categoriesRes, budgetRes, txRes, profileRes] = await Promise.all([
    supabase.from('categories').select('*').neq('kind', 'income').order('sort_order').order('name'),
    supabase
      .from('budgets')
      .select('id, amount, budget_categories(category_id, amount)')
      .eq('year', ref.year)
      .eq('month', ref.month)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('category_id, amount, type')
      .eq('type', 'expense')
      .gte('date', from)
      .lte('date', to),
    supabase.from('profiles').select('currency').eq('user_id', user.id).maybeSingle(),
  ]);

  const categories = (categoriesRes.data ?? []) as Category[];
  const planned = new Map<string, number>();
  for (const line of (budgetRes.data?.budget_categories ?? []) as BudgetCategory[]) {
    planned.set(line.category_id, Number(line.amount));
  }

  const spent = new Map<string, number>();
  for (const tx of (txRes.data ?? []) as Pick<Transaction, 'category_id' | 'amount'>[]) {
    if (!tx.category_id) continue;
    spent.set(tx.category_id, (spent.get(tx.category_id) ?? 0) + Number(tx.amount));
  }

  const rows: BudgetRow[] = categories.map((category) => ({
    category: { id: category.id, name: category.name, icon: category.icon, color: category.color },
    planned: planned.get(category.id) ?? 0,
    spent: spent.get(category.id) ?? 0,
  }));

  const currency = (profileRes.data as Pick<Profile, 'currency'> | null)?.currency ?? 'MDL';

  return <BudgetsView year={ref.year} month={ref.month} rows={rows} currency={currency} />;
}
