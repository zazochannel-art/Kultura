'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/context';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'mf_install_dismissed';

/**
 * The A2HS prompt, shown only once the browser says the app is installable and
 * only if the user has not already waved it away.
 */
export function InstallPrompt() {
  const t = useT();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch {
      // Private mode with storage blocked: show the prompt, it is harmless.
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setDeferred(null);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Nothing to fall back to, and nothing that breaks without it.
    }
  };

  if (!deferred) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-40 flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-2xl lg:right-6 lg:bottom-6 lg:left-auto lg:w-80">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Download className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t('pwa.install')}</p>
        <p className="truncate text-xs text-muted-foreground">{t('pwa.installHint')}</p>
      </div>
      <Button
        size="sm"
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          dismiss();
        }}
      >
        {t('pwa.install')}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('pwa.dismiss')}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
