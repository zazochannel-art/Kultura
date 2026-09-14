'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

export function OfflineBanner() {
  const t = useT();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-xs font-medium text-warning"
    >
      <WifiOff className="size-3.5" aria-hidden />
      {t('pwa.offline')}
    </div>
  );
}
