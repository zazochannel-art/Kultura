"use client";

import { useMemo } from "react";
import {
  Camera,
  CheckCircle2,
  FileCheck,
  FileText,
  Flag,
  Package,
  PlayCircle,
  PlusCircle,
  Timer,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Expense,
  Job,
  JobMaterial,
  JobPhoto,
  Payment,
  Quote,
  WorkSession,
} from "@/lib/types";
import { PAYMENT_KIND_LABELS } from "@/lib/constants";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";
import { useApp } from "@/lib/app-provider";

interface TimelineEvent {
  at: string;
  icon: LucideIcon;
  title: string;
  detail?: string;
  tone: string;
}

/**
 * Jurnalul lucrării. Nu ținem un tabel separat de evenimente: povestea se
 * reconstruiește din datele existente, deci rămâne corectă chiar dacă ștergi
 * ceva pe parcurs.
 */
export function ActivityTab({
  job,
  payments,
  materials,
  photos,
  sessions,
  expenses,
  quotes,
}: {
  job: Job;
  payments: Payment[];
  materials: JobMaterial[];
  photos: JobPhoto[];
  sessions: WorkSession[];
  expenses: Expense[];
  quotes: Quote[];
}) {
  const { currency } = useApp();

  const events = useMemo(() => {
    const list: TimelineEvent[] = [
      {
        at: job.created_at,
        icon: PlusCircle,
        title: "Comandă creată",
        detail: job.title,
        tone: "bg-muted text-muted-foreground",
      },
    ];

    for (const quote of quotes) {
      if (quote.sent_at) {
        list.push({
          at: quote.sent_at,
          icon: FileText,
          title: "Ofertă trimisă",
          detail: quote.title,
          tone: "bg-cyan-500/10 text-cyan-300",
        });
      }
      if (quote.accepted_at) {
        list.push({
          at: quote.accepted_at,
          icon: FileCheck,
          title: "Client a confirmat",
          detail: quote.title,
          tone: "bg-violet-500/10 text-violet-300",
        });
      }
    }

    for (const payment of payments) {
      list.push({
        at: payment.created_at,
        icon: Wallet,
        title: `${PAYMENT_KIND_LABELS[payment.kind]} — ${formatMoney(payment.amount, currency)}`,
        detail: payment.note ?? undefined,
        tone: "bg-emerald-500/10 text-emerald-300",
      });
    }

    const purchased = materials.filter((material) => material.purchased);
    if (purchased.length) {
      const last = purchased.reduce(
        (acc, material) =>
          material.updated_at > acc ? material.updated_at : acc,
        purchased[0].updated_at,
      );
      list.push({
        at: last,
        icon: Package,
        title: "Materiale cumpărate",
        detail: `${purchased.length} din ${materials.length}`,
        tone: "bg-amber-500/10 text-amber-300",
      });
    }

    for (const expense of expenses) {
      list.push({
        at: expense.created_at,
        icon: Package,
        title: `Cheltuială — ${formatMoney(expense.amount, currency)}`,
        detail: expense.note ?? undefined,
        tone: "bg-red-500/10 text-red-300",
      });
    }

    const ordered = [...sessions].sort((a, b) =>
      a.started_at.localeCompare(b.started_at),
    );
    ordered.forEach((session, index) => {
      list.push({
        at: session.started_at,
        icon: index === 0 ? PlayCircle : Timer,
        title: index === 0 ? "Lucrare începută" : "Sesiune de lucru",
        detail: session.ended_at
          ? `Durată: ${formatDuration(session.duration_minutes)}`
          : "În desfășurare",
        tone: "bg-cyan-500/10 text-cyan-300",
      });
    });

    const photosByStage = photos.reduce<Record<string, JobPhoto[]>>(
      (acc, photo) => {
        (acc[photo.stage] ||= []).push(photo);
        return acc;
      },
      {},
    );
    for (const [stage, list_] of Object.entries(photosByStage)) {
      const last = list_.reduce(
        (acc, photo) => (photo.created_at > acc ? photo.created_at : acc),
        list_[0].created_at,
      );
      list.push({
        at: last,
        icon: Camera,
        title: `Fotografii „${stage === "before" ? "înainte" : stage === "during" ? "în timpul lucrării" : "după"}”`,
        detail: `${list_.length} poze`,
        tone: "bg-violet-500/10 text-violet-300",
      });
    }

    if (job.status === "done" && job.end_date) {
      list.push({
        at: `${job.end_date}T23:59:00.000Z`,
        icon: CheckCircle2,
        title: "Lucrare finalizată",
        tone: "bg-emerald-500/10 text-emerald-300",
      });
    }

    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [job, payments, materials, photos, sessions, expenses, quotes, currency]);

  return (
    <ol className="relative space-y-1 border-l border-border pl-0">
      {events.map((event, index) => (
        <li
          key={`${event.at}-${index}`}
          className="relative flex gap-3 pb-4 pl-5"
        >
          <span className="absolute -left-[13px] top-1">
            <span
              className={`flex size-6 items-center justify-center rounded-full ring-4 ring-background ${event.tone}`}
            >
              <event.icon className="size-3.5" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{event.title}</p>
            {event.detail && (
              <p className="truncate text-xs text-muted-foreground">
                {event.detail}
              </p>
            )}
            <p className="text-xs text-muted-foreground/70">
              {formatDateTime(event.at)}
            </p>
          </div>
        </li>
      ))}
      {!events.length && (
        <li className="flex items-center gap-2 pl-5 text-sm text-muted-foreground">
          <Flag className="size-4" /> Nicio activitate încă
        </li>
      )}
    </ol>
  );
}
