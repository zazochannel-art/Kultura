import { Database } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export const metadata = { title: 'Setup' };

/**
 * Shown when the auth user exists but their profile does not — which in
 * practice means the migrations in `supabase/migrations` have not been applied.
 */
export default async function SetupRequiredPage() {
  const { t } = await getT();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
        <Database className="size-7" aria-hidden />
      </span>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold">{t('error.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('error.noSupabase')}</p>
        <p className="text-xs text-muted-foreground">
          supabase/migrations → Supabase SQL editor, or <code>supabase db push</code>.
        </p>
      </div>
    </main>
  );
}
