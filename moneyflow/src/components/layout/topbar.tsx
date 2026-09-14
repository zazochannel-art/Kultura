'use client';

import Link from 'next/link';
import { LogOut, Plus, Settings, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { initials } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { useQuickAdd } from './quick-add-context';
import type { AppNotification } from '@/lib/types/database';

export function Topbar({
  name,
  email,
  notifications,
}: {
  name: string | null;
  email: string;
  notifications: AppNotification[];
}) {
  const t = useT();
  const { openQuickAdd } = useQuickAdd();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-lg">
      <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Wallet className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-[0.16em]">{t('app.name')}</span>
      </Link>

      <div className="flex-1" />

      <Button
        size="sm"
        variant="soft"
        className="hidden lg:inline-flex"
        onClick={() => openQuickAdd('expense')}
      >
        <Plus className="size-4" aria-hidden />
        {t('tx.add')}
      </Button>

      <NotificationBell notifications={notifications} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={t('settings.profile')}
          >
            {initials(name ?? email)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate normal-case">{name ?? email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="size-4" aria-hidden />
              {t('nav.settings')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild variant="danger">
            <form action="/auth/signout" method="post" className="w-full">
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut className="size-4" aria-hidden />
                {t('nav.signOut')}
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
