"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CloudOff, WifiOff, X } from "lucide-react";
import { useApp } from "@/lib/app-provider";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { AppHeader } from "./app-header";
import { QuickAdd } from "./quick-add";
import { ActiveWorkBar } from "./active-work-bar";
import { Logo } from "./logo";
import { NotificationEngine } from "@/components/notifications/engine";

const LOCAL_NOTICE_KEY = "montajpro.hide-local-notice";

function localNoticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOCAL_NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Scheletul aplicației: bară laterală pe desktop, bară de jos pe telefon.
 * Tot ce ține de sesiune (redirect la login, stare de încărcare) trece pe aici.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, mode, userId, online } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [localNoticeHidden, setLocalNoticeHidden] = useState(localNoticeDismissed);

  const needsLogin = mode === "cloud" && !userId;

  useEffect(() => {
    if (needsLogin && pathname !== "/login") router.replace("/login");
  }, [needsLogin, pathname, router]);

  const hideLocalNotice = useCallback(() => {
    setLocalNoticeHidden(true);
    try {
      window.localStorage.setItem(LOCAL_NOTICE_KEY, "1");
    } catch {
      // Stocarea poate fi blocată — mesajul revine la următoarea deschidere.
    }
  }, []);

  if (needsLogin || !ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <Logo />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Se încarcă datele…</p>
        <style>{`@keyframes loading { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Sidebar onQuickAdd={() => setQuickAddOpen(true)} />

      <div className="lg:pl-64">
        <AppHeader />

        {!online && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-200 sm:mx-4 lg:mx-8">
            <WifiOff className="size-4 shrink-0" />
            <span>Ești offline. Datele se salvează pe telefon și se trimit automat.</span>
          </div>
        )}

        {mode === "local" && online && !localNoticeHidden && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-muted-foreground sm:mx-4 lg:mx-8">
            <CloudOff className="size-4 shrink-0" />
            <span className="flex-1">
              Mod local — datele rămân pe acest dispozitiv.{" "}
              <Link
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Conectează-te
              </Link>{" "}
              ca să sincronizezi.
            </span>
            <button
              type="button"
              onClick={hideLocalNotice}
              aria-label="Ascunde mesajul"
              className="-mr-1 shrink-0 rounded-lg p-1 hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <ActiveWorkBar />

        <main className="mx-auto w-full max-w-6xl px-3 pb-[calc(var(--bottom-nav-h)+2rem)] pt-4 sm:px-4 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <BottomNav onQuickAdd={() => setQuickAddOpen(true)} />
      <QuickAdd open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      <NotificationEngine />
    </div>
  );
}
