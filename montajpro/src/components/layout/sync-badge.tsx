"use client";

import {
  Check,
  CloudOff,
  Loader2,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/lib/app-provider";
import { cn } from "@/lib/utils";

/**
 * Indicatorul de sincronizare. Pe șantier contează să vezi dintr-o privire
 * dacă datele au ajuns în cloud sau așteaptă semnal.
 */
export function SyncBadge({ className }: { className?: string }) {
  const { syncStatus, pendingChanges, online, sync, mode } = useApp();

  const state = !online
    ? {
        icon: WifiOff,
        label: pendingChanges ? `${pendingChanges} în așteptare` : "Offline",
        tone: "text-amber-300",
      }
    : mode === "local"
      ? { icon: CloudOff, label: "Mod local", tone: "text-muted-foreground" }
      : syncStatus === "syncing"
        ? { icon: Loader2, label: "Se sincronizează", tone: "text-cyan-300" }
        : syncStatus === "error"
          ? {
              icon: TriangleAlert,
              label: "Eroare sincronizare",
              tone: "text-red-300",
            }
          : pendingChanges > 0
            ? {
                icon: RefreshCw,
                label: `${pendingChanges} de trimis`,
                tone: "text-amber-300",
              }
            : { icon: Check, label: "Sincronizat", tone: "text-emerald-300" };

  const Icon = state.icon;

  return (
    <button
      type="button"
      onClick={() => void sync()}
      title={state.label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent",
        state.tone,
        className,
      )}
    >
      <Icon
        className={cn("size-3.5", syncStatus === "syncing" && "animate-spin")}
      />
      <span className="hidden sm:inline">{state.label}</span>
    </button>
  );
}
