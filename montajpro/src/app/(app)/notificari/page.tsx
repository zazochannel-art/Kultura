"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  FileText,
  Package,
  ShieldAlert,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useTable } from "@/hooks/use-data";
import { dismissNotification, markNotificationRead } from "@/lib/db/actions";
import { formatDateTime } from "@/lib/format";
import type { NotificationKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationKind, LucideIcon> = {
  job_today: CalendarClock,
  job_tomorrow: CalendarClock,
  payment_due: Wallet,
  tool_warranty: ShieldAlert,
  materials_missing: Package,
  quote_pending: FileText,
};

const TONES: Record<NotificationKind, string> = {
  job_today: "bg-cyan-500/10 text-cyan-300",
  job_tomorrow: "bg-violet-500/10 text-violet-300",
  payment_due: "bg-amber-500/10 text-amber-300",
  tool_warranty: "bg-red-500/10 text-red-300",
  materials_missing: "bg-amber-500/10 text-amber-300",
  quote_pending: "bg-fuchsia-500/10 text-fuchsia-300",
};

export default function NotificationsPage() {
  const notifications = useTable("notifications");

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [notifications],
  );
  const unread = sorted.filter((item) => !item.read_at);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notificări"
        description={unread.length ? `${unread.length} necitite` : "Totul e la zi"}
        action={
          unread.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                for (const item of unread) await markNotificationRead(item.id);
                toast.success("Toate marcate ca citite");
              }}
            >
              <CheckCheck /> Marchează citite
            </Button>
          ) : null
        }
      />

      {sorted.length ? (
        <ul className="space-y-2">
          {sorted.map((item) => {
            const Icon = ICONS[item.kind] ?? Bell;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3.5",
                  item.read_at
                    ? "border-border bg-card/60"
                    : "border-primary/30 bg-card",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    TONES[item.kind] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium", item.read_at && "text-muted-foreground")}>
                    {item.title}
                  </p>
                  {item.body && (
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70">
                    {formatDateTime(item.created_at)}
                  </p>
                  {item.job_id && (
                    <Link
                      href={`/lucrari/${item.job_id}`}
                      onClick={() => void markNotificationRead(item.id)}
                      className="mt-1 inline-block text-xs text-primary hover:underline"
                    >
                      Deschide lucrarea
                    </Link>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-0.5">
                  {!item.read_at && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Marchează citită"
                      onClick={() => void markNotificationRead(item.id)}
                    >
                      <CheckCheck />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Ascunde"
                    onClick={() => void dismissNotification(item.id)}
                  >
                    <X className="text-muted-foreground" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={BellOff}
          title="Nicio notificare"
          description="Te anunțăm despre lucrări programate, plăți restante, materiale lipsă și garanții care expiră."
        />
      )}
    </div>
  );
}
