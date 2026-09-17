"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { NAV_SECTIONS, isActivePath } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";
import { useApp } from "@/lib/app-provider";
import { useTable } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

/** Bara laterală — doar pe desktop (`lg:` în sus). */
export function Sidebar({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const { settings, email, mode } = useApp();
  const notifications = useTable("notifications");
  const jobs = useTable("jobs");

  const counts = {
    notifications: notifications.filter((item) => !item.read_at).length,
    active_jobs: jobs.filter((job) =>
      ["confirmed", "materials", "in_progress"].includes(job.status),
    ).length,
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <div className="px-4 pb-4">
        <Button className="w-full" size="lg" onClick={onQuickAdd}>
          <Plus /> Adaugă
        </Button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-[18px]" />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                            active
                              ? "bg-primary/20"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <Link
        href="/setari"
        className="flex items-center gap-3 border-t border-border p-4 transition-colors hover:bg-accent"
      >
        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-semibold text-black">
          {initials(settings?.full_name || email || "M")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {settings?.full_name || "Montator"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {mode === "local" ? "Mod local" : (email ?? "Cont sincronizat")}
          </p>
        </div>
      </Link>
    </aside>
  );
}
