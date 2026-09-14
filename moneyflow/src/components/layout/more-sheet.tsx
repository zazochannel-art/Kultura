'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav-items';
import { isActive } from './sidebar';

/** The phone overflow menu: everything the five-slot bar cannot hold. */
export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT();
  const pathname = usePathname();
  const items = [...PRIMARY_NAV, ...SECONDARY_NAV];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('nav.more')}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border border-border px-2 py-3 text-center text-xs font-medium transition-colors',
                  active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50',
                )}
              >
                <item.icon className={cn('size-5', active && 'text-primary')} aria-hidden />
                <span className="line-clamp-2 leading-tight">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>

        <Separator />

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
          >
            <LogOut className="size-4" aria-hidden />
            {t('nav.signOut')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
