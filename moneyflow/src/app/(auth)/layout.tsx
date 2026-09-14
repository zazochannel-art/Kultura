import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { I18nProvider } from '@/lib/i18n/context';
import { getLanguage } from '@/lib/i18n/server';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = await getT();
  const lang = await getLanguage();

  return (
    <I18nProvider lang={lang} currency="MDL">
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
        {/* A single soft wash behind the card — the only decoration on these screens. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60"
          style={{
            background:
              'radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)',
          }}
        />

        <div className="relative z-10 w-full max-w-sm space-y-8 animate-rise">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Wallet className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-[0.18em]">{t('app.name')}</p>
              <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
            </div>
          </div>

          {children}
        </div>
      </main>
    </I18nProvider>
  );
}
