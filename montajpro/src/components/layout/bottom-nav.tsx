"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { BOTTOM_NAV, isActivePath } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Navigația de jos + butonul flotant „+”, montate într-o singură bară ca să nu
 * acopere conținutul. Apare doar pe mobil și tabletă.
 */
export function BottomNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const [left, right] = [BOTTOM_NAV.slice(0, 2), BOTTOM_NAV.slice(2)];

  const renderItem = (item: (typeof BOTTOM_NAV)[number]) => {
    const active = isActivePath(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <item.icon
          className={cn(
            "size-[22px]",
            active && "drop-shadow-[0_0_8px_var(--primary)]",
          )}
        />
        <span className="text-[11px] font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden">
      <div className="mx-auto flex max-w-3xl items-stretch gap-1 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
        {left.map(renderItem)}

        <div className="flex w-16 shrink-0 items-start justify-center">
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label="Adaugă"
            className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-black shadow-xl shadow-primary/30 transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </button>
        </div>

        {right.map(renderItem)}
      </div>
    </nav>
  );
}
