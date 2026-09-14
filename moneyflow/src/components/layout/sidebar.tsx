'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from './nav-items';
import { useQuickAdd } from './quick-add-context';

export function Sidebar() {
  const t = useT();
  const pathname = usePathname();
  const { openQuickAdd } = useQuickAdd();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-r border-border bg-card/40 px-3 py-5 lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Wallet className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-[0.18em]">{t('app.name')}</span>
      </Link>

      <Button onClick={() => openQuickAdd('expense')} className="w-full justify-start gap-2">
        <Plus className="size-4" aria-hidden />
        {t('tx.add')}
      </Button>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {PRIMARY_NAV.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <Separator className="my-2" />

        {SECONDARY_NAV.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useT();
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      <Icon className={cn('size-4 shrink-0', active && 'text-primary')} aria-hidden />
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  );
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
