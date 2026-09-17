"use client";

import { Suspense, use, useEffect, useState } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Camera,
  Info,
  Package,
  Play,
  Ruler,
  Square,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/jobs/status-badge";
import { OverviewTab } from "@/components/jobs/tabs/overview-tab";
import { MeasurementsTab } from "@/components/jobs/tabs/measurements-tab";
import { PhotosTab } from "@/components/jobs/tabs/photos-tab";
import { MaterialsTab } from "@/components/jobs/tabs/materials-tab";
import { FinanceTab } from "@/components/jobs/tabs/finance-tab";
import { ActivityTab } from "@/components/jobs/tabs/activity-tab";
import { useJobDetails, useStoreReady } from "@/hooks/use-data";
import { startWork, stopWork } from "@/lib/db/actions";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { formatDuration, formatMoney, formatStopwatch } from "@/lib/format";
import { useApp } from "@/lib/app-provider";

const TABS = [
  { value: "general", label: "General", icon: Info },
  { value: "masuratori", label: "Măsurători", icon: Ruler },
  { value: "poze", label: "Poze", icon: Camera },
  { value: "materiale", label: "Materiale", icon: Package },
  { value: "finante", label: "Finanțe", icon: Wallet },
  { value: "activitate", label: "Activitate", icon: Activity },
];

function JobDetail({ id }: { id: string }) {
  const ready = useStoreReady();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency } = useApp();
  const details = useJobDetails(id);
  const [tab, setTab] = useState(searchParams.get("tab") ?? "general");
  const [elapsed, setElapsed] = useState(0);

  const session = details.activeSession;

  useEffect(() => {
    if (!session) return;
    const started = new Date(session.started_at).getTime();
    const tick = () => setElapsed(Date.now() - started);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { job } = details;
  if (!job) notFound();

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">
            {JOB_TYPE_EMOJI[job.type]}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{job.title}</h2>
            <p className="text-sm text-muted-foreground">
              {JOB_TYPE_LABELS[job.type]} · {details.client?.name ?? "Fără client"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={job.status} />
              <span className="text-sm font-semibold tabular-nums">
                {formatMoney(job.price_total, currency)}
              </span>
              {details.money.rest > 0 && (
                <span className="text-xs text-amber-300">
                  rest {formatMoney(details.money.rest, currency)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {session ? (
            <button
              type="button"
              onClick={async () => {
                const stopped = await stopWork(session.id);
                toast.success(
                  stopped
                    ? `Ai lucrat ${formatDuration(stopped.duration_minutes)}`
                    : "Cronometru oprit",
                );
                router.refresh();
              }}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-red-500 text-base font-bold text-white transition-transform active:scale-[0.98]"
            >
              <Square className="size-5 fill-current" />
              FINALIZEAZĂ
              <span className="font-mono tabular-nums">{formatStopwatch(elapsed)}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await startWork(job.id);
                toast.success("Cronometru pornit");
              }}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 text-base font-bold text-emerald-950 transition-transform active:scale-[0.98]"
            >
              <Play className="size-5 fill-current" /> START LUCRARE
            </button>
          )}
          {details.workedMinutes > 0 && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Ai lucrat {formatDuration(details.workedMinutes)} în total
            </p>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              <item.icon />
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general">
          <OverviewTab
            job={job}
            client={details.client}
            money={details.money}
            workedMinutes={details.workedMinutes}
          />
        </TabsContent>
        <TabsContent value="masuratori">
          <MeasurementsTab job={job} measurements={details.measurements} />
        </TabsContent>
        <TabsContent value="poze">
          <PhotosTab job={job} photos={details.photos} />
        </TabsContent>
        <TabsContent value="materiale">
          <MaterialsTab jobId={job.id} materials={details.materials} />
        </TabsContent>
        <TabsContent value="finante">
          <FinanceTab
            job={job}
            money={details.money}
            payments={details.payments}
            expenses={details.expenses}
          />
        </TabsContent>
        <TabsContent value="activitate">
          <ActivityTab
            job={job}
            payments={details.payments}
            materials={details.materials}
            photos={details.photos}
            sessions={details.sessions}
            expenses={details.expenses}
            quotes={details.quotes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <JobDetail id={id} />
    </Suspense>
  );
}
