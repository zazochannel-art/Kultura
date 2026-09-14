import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/actions/auth-guard';

/** Marks notifications read. Called by the bell; nothing else writes here. */
export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { ids?: unknown; all?: unknown };
  const query = session.supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (body.all === true) {
    const { error } = await query;
    return NextResponse.json({ ok: !error });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string')
    : [];
  if (ids.length === 0) return NextResponse.json({ ok: true });

  const { error } = await query.in('id', ids.slice(0, 100));
  return NextResponse.json({ ok: !error });
}
