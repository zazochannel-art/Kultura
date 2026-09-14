'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/context';

type PermissionState = NotificationPermission | 'unsupported';

/** The Notification permission is browser state, so it is read, not mirrored. */
const subscribe = () => () => {};
const getSnapshot = (): PermissionState =>
  typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
const getServerSnapshot = (): PermissionState => 'unsupported';

/**
 * Asks for browser notification permission, and only when the user clicks — an
 * unprompted permission dialog on first load is how apps get blocked forever.
 */
export function PushPermission() {
  const t = useT();
  const browserPermission = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [granted, setGranted] = useState<NotificationPermission | null>(null);

  const permission = granted ?? browserPermission;

  const request = useCallback(async () => {
    setGranted(await Notification.requestPermission());
  }, []);

  if (permission === 'unsupported') return null;

  if (permission === 'granted') {
    return <p className="text-sm text-success">{t('notifications.enabled')}</p>;
  }

  if (permission === 'denied') {
    return <p className="text-sm text-muted-foreground">{t('notifications.blocked')}</p>;
  }

  return (
    <Button variant="outline" size="sm" onClick={request}>
      <Bell className="size-4" aria-hidden />
      {t('notifications.enable')}
    </Button>
  );
}
