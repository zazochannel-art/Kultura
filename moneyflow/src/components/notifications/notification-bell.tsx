'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { formatDate } from '@/lib/format';
import type { AppNotification } from '@/lib/types/database';

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function NotificationBell({ notifications }: { notifications: AppNotification[] }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const unread = useMemo(() => notifications.filter((n) => !n.read_at), [notifications]);

  const markAll = () => {
    startTransition(async () => {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      router.refresh();
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('notifications.title')}
          className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Bell className="size-4.5" aria-hidden />
          {unread.length > 0 ? (
            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">{t('notifications.title')}</p>
          {unread.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAll} disabled={pending}>
              <Check className="size-3.5" aria-hidden />
              {t('notifications.markAllRead')}
            </Button>
          ) : null}
        </div>
        <Separator />

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <BellOff className="size-5" aria-hidden />
            {t('notifications.empty')}
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => {
              const content = (
                <>
                  <span
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      SEVERITY_STYLES[notification.severity] ?? 'bg-muted-foreground',
                      notification.read_at && 'opacity-40',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-sm leading-snug',
                        notification.read_at ? 'text-muted-foreground' : 'font-medium',
                      )}
                    >
                      {notification.title}
                    </span>
                    {notification.body ? (
                      <span className="block text-xs text-muted-foreground">{notification.body}</span>
                    ) : null}
                    <span className="block pt-0.5 text-[11px] text-muted-foreground">
                      {formatDate(notification.created_at, lang, 'short')}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={notification.id} className="border-b border-border last:border-0">
                  {notification.href ? (
                    <Link
                      href={notification.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-2.5 px-4 py-3 transition-colors hover:bg-accent/50"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex gap-2.5 px-4 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
