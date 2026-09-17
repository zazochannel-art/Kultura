"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, Menu } from "lucide-react";
import { useState } from "react";
import { NAV_SECTIONS, isActivePath } from "@/lib/nav";
import { useTable } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Logo } from "./logo";
import { SyncBadge } from "./sync-badge";

/** Antetul mobil: înapoi / titlu / notificări + meniu complet. */
export function AppHeader({ title }: { title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const notifications = useTable("notifications");
  const unread = notifications.filter((item) => !item.read_at).length;

  const isRoot = pathname === "/";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4 lg:h-16 lg:px-8">
          {isRoot ? (
            <div className="lg:hidden">
              <Logo />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Înapoi"
              className="-ml-1 flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}

          {title && (
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold lg:text-lg">
              {title}
            </h1>
          )}
          {!title && <div className="flex-1" />}

          <SyncBadge />

          <Link
            href="/notificari"
            aria-label="Notificări"
            className="relative flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Meniu"
            className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Meniu</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border p-3 text-sm font-medium transition-colors",
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-accent",
                        )}
                      >
                        <item.icon className="size-[18px] shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
