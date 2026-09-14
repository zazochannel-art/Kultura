import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getT } from '@/lib/i18n/server';

export default async function NotFound() {
  const { t } = await getT();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-muted-foreground">
        <Compass className="size-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('error.notFound')}</h1>
        <p className="text-sm text-muted-foreground">{t('error.notFoundBody')}</p>
      </div>
      <Button asChild>
        <Link href="/dashboard">{t('error.goHome')}</Link>
      </Button>
    </main>
  );
}
