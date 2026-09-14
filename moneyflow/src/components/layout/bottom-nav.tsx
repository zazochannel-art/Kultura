'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import { MOBILE_NAV } from './nav-items';
import { isActive } from './sidebar';
import { useQuickAdd } from './quick-add-context';

/**
 * The phone bar. The add button sits in the middle, raised, because adding an
 * expense is the thing people open this app to do — everything else is reading.
 */
export function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const { openQuickAdd } = useQuickAdd();

  const left = MOBILE_NAV.slice(0, 2);
  const right = MOBILE_NAV.slice(2);

  return (
    <nav className="mf-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1.5 pb-1.5">
        {left.map((item) => (
          <NavTab key={item.href} href={item.href} active={isActive(pathname, item.href)}>
            <item.icon className="size-5" aria-hidden />
            {t(item.labelKey)}
          </NavTab>
        ))}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => openQuickAdd('expense')}
            aria-label={t('tx.add')}
            className="flex size-13 -translate-y-3 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
            style={{ width: '3.25rem', height: '3.25rem' }}
          >
            <Plus className="size-6" aria-hidden />
          </button>
        </div>

        {right.map((item) => (
          <NavTab key={item.href} href={item.href} active={isActive(pathname, item.href)}>
            <item.icon className="size-5" aria-hidden />
            {t(item.labelKey)}
          </NavTab>
        ))}

        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Menu className="size-5" aria-hidden />
          {t('nav.more')}
        </button>
      </div>
    </nav>
  );
}

function NavTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}
