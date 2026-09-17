"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Navigation, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { formatDuration, formatMoney } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { useActiveSession, useClientName } from "@/hooks/use-data";
import { startWork, stopWork } from "@/lib/db/actions";
import { mapsHref } from "@/lib/utils";
import type { Job } from "@/lib/types";
import { StatusBadge } from "@/components/jobs/status-badge";

/**
 * Cardul zilei curente — cel mai folosit ecran dimineața: oră, client, adresă,
 * bani și cele trei acțiuni de pe teren.
 */
export function TodayJobCard({ job }: { job: Job }) {
  const { currency } = useApp();
  const router = useRouter();
  const clientName = useClientName(job.client_id);
  const activeSession = useActiveSession();
  const running = activeSession?.job_id === job.id ? activeSession : null;
  const maps = mapsHref(job.address);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-lg font-bold tabular-nums text-primary">
            {job.scheduled_time || "--:--"}
          </span>
          <span className="text-2xl">{JOB_TYPE_EMOJI[job.type]}</span>
        </div>

        <div className="min-w-0 flex-1">
          <Link href={`/lucrari/${job.id}`} className="block">
            <p className="truncate text-base font-semibold">{clientName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {job.title} · {JOB_TYPE_LABELS[job.type]}
            </p>
            {job.address && (
              <p className="truncate text-sm text-muted-foreground">
                {job.address}
              </p>
            )}
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tabular-nums">
              {formatMoney(job.price_total, currency)}
            </span>
            <StatusBadge status={job.status} />
            {job.estimated_hours ? (
              <span className="text-xs text-muted-foreground">
                ~{formatDuration(job.estimated_hours * 60)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Link
          href={`/lucrari/${job.id}`}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent"
        >
          <Eye className="size-4" /> Vezi
        </Link>

        {running ? (
          <button
            type="button"
            onClick={async () => {
              const stopped = await stopWork(running.id);
              toast.success(
                stopped
                  ? `Ai lucrat ${formatDuration(stopped.duration_minutes)}`
                  : "Oprit",
              );
            }}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-red-500/90 text-sm font-semibold text-white transition-transform active:scale-95"
          >
            <Square className="size-4 fill-current" /> Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              await startWork(job.id);
              toast.success("Cronometru pornit");
              router.refresh();
            }}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-sm font-semibold text-emerald-950 transition-transform active:scale-95"
          >
            <Play className="size-4 fill-current" /> Start
          </button>
        )}

        <a
          href={maps ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!maps}
          onClick={(event) => {
            if (!maps) {
              event.preventDefault();
              toast.info("Adaugă o adresă la lucrare ca să poți naviga");
            }
          }}
          className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent ${
            maps ? "" : "opacity-60"
          }`}
        >
          <Navigation className="size-4" /> Navighează
        </a>
      </div>
    </div>
  );
}
