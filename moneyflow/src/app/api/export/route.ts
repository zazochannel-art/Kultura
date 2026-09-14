import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/actions/auth-guard';

export const dynamic = 'force-dynamic';

const TABLES = [
  'profiles',
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'budget_categories',
  'goals',
  'goal_contributions',
  'recurring_transactions',
  'debts',
  'monthly_reports',
] as const;

/** RFC 4180 quoting: a field containing a quote, comma or newline gets wrapped. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(','));
  }
  return lines.join('\r\n');
}

/**
 * "Export data" in Settings. Everything the user owns, in one request —
 * RLS means each query can only ever return their own rows.
 */
export async function GET(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const stamp = new Date().toISOString().slice(0, 10);

  const results = await Promise.all(
    TABLES.map(async (table) => {
      const { data } = await session.supabase.from(table).select('*');
      return [table, (data ?? []) as Array<Record<string, unknown>>] as const;
    }),
  );

  if (format === 'csv') {
    // One file, sections separated by a blank line and a table header — a CSV
    // per table would need a zip, and this still opens in any spreadsheet.
    const body = results
      .map(([table, rows]) => `# ${table}\r\n${toCsv(rows)}`)
      .join('\r\n\r\n');

    return new NextResponse(body, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="moneyflow-${stamp}.csv"`,
      },
    });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    app: 'MONEYFLOW',
    data: Object.fromEntries(results),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="moneyflow-${stamp}.json"`,
    },
  });
}
