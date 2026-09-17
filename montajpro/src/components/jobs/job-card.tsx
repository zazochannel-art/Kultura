"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin, User } from "lucide-react";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { formatDateShort, formatMoney, relativeDay } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { useClientName, useJobPaymentIndex } from "@/hooks/use-data";
import type { Job } from "@/lib/types";
import { StatusBadge } from "./status-badge";

/**
 * Cardul unei lucrări. Fără tabele pe mobil: tot ce contează (client, preț,
 * rest de plată, status) încape într-un card apăsabil.
 */
export function JobCard({ job }: { job: Job }) {
  const { currency } = useApp();
  const clientName = useClientName(job.client_id);
  const payments = useJobPaymentIndex();
  const money = payments[job.id];
  const day = relativeDay(job.scheduled_date);

  return (
    <Link
      href={`/lucrari/${job.id}`}
      className="card-hover block rounded-2xl border border-border bg-card p-4 hover:border-primary/40"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
          {JOB_TYPE_EMOJI[job.type]}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate font-semibold">{job.title}</p>
            <StatusBadge status={job.status} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {clientName}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              {day ?? formatDateShort(job.scheduled_date)}
              {job.scheduled_time && ` · ${job.scheduled_time}`}
            </span>
            {job.address && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{job.address}</span>
              </span>
            )}
          </div>

          <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Preț</p>
                <p className="font-semibold tabular-nums">
                  {formatMoney(job.price_total, currency, { compact: true })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Avans</p>
                <p className="font-semibold tabular-nums text-emerald-300">
                  {formatMoney(money?.advance ?? 0, currency, {
                    compact: true,
                  })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Rest</p>
                <p
                  className={`font-semibold tabular-nums ${
                    (money?.rest ?? 0) > 0
                      ? "text-amber-300"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatMoney(money?.rest ?? 0, currency, { compact: true })}
                </p>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </div>
      </div>
      <span className="sr-only">{JOB_TYPE_LABELS[job.type]}</span>
    </Link>
  );
}
