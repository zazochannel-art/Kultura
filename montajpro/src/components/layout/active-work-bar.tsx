"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { useActiveSession, useTable } from "@/hooks/use-data";
import { stopWork } from "@/lib/db/actions";
import { formatDuration, formatStopwatch } from "@/lib/format";

/**
 * Bara cronometrului activ. Rămâne vizibilă în toată aplicația, ca să nu uiți
 * niciodată o lucrare pornită.
 */
export function ActiveWorkBar() {
  const session = useActiveSession();
  const jobs = useTable("jobs");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!session) return;
    const started = new Date(session.started_at).getTime();
    const tick = () => setElapsed(Date.now() - started);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  if (!session) return null;
  const job = jobs.find((row) => row.id === session.job_id);

  return (
    <div className="sticky top-14 z-20 lg:top-16">
      <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 sm:mx-4 lg:mx-8">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
          <Timer className="size-5 animate-pulse" />
        </span>
        <Link href={`/lucrari/${session.job_id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {job?.title ?? "Lucrare"}
          </p>
          <p className="font-mono text-lg font-bold tabular-nums text-emerald-300">
            {formatStopwatch(elapsed)}
          </p>
        </Link>
        <button
          type="button"
          onClick={async () => {
            const stopped = await stopWork(session.id);
            toast.success(
              stopped
                ? `Ai lucrat ${formatDuration(stopped.duration_minutes)}`
                : "Cronometru oprit",
            );
          }}
          className="flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 transition-transform active:scale-95"
        >
          <Square className="size-4 fill-current" />
          Stop
        </button>
      </div>
    </div>
  );
}
