"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Confirm } from "@/components/ui/confirm";
import { DerivedPanel } from "@/components/measurements/measurement-fields";
import { useStoreReady, useTable } from "@/hooks/use-data";
import { deleteMeasurement } from "@/lib/db/actions";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { JOB_TYPES } from "@/lib/types";
import type { JobType } from "@/lib/types";
import { measurementSummary } from "@/lib/calc";
import { formatDateShort } from "@/lib/format";

type Filter = JobType | "all";

export default function MeasurementsPage() {
  const ready = useStoreReady();
  const measurements = useTable("job_measurements");
  const jobs = useTable("jobs");
  const clients = useTable("clients");
  const [filter, setFilter] = useState<Filter>("all");

  const sorted = useMemo(
    () =>
      [...measurements]
        .filter((measurement) => filter === "all" || measurement.kind === filter)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [measurements, filter],
  );

  const counts = useMemo(() => {
    const result = { all: measurements.length } as Record<Filter, number>;
    for (const type of JOB_TYPES) {
      result[type] = measurements.filter((measurement) => measurement.kind === type).length;
    }
    return result;
  }, [measurements]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Măsurători"
        description="Notează dimensiunile pe teren, calculele se fac singure"
        action={
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/masuratori/nou">
              <Plus /> Măsurătoare
            </Link>
          </Button>
        }
      />

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Toate", count: counts.all },
          ...JOB_TYPES.map((type) => ({
            value: type as Filter,
            label: JOB_TYPE_LABELS[type],
            count: counts[type],
          })),
        ]}
      />

      {!ready ? (
        <Skeleton className="h-48 w-full" />
      ) : sorted.length ? (
        <div className="space-y-3">
          {sorted.map((measurement) => {
            const job = jobs.find((row) => row.id === measurement.job_id);
            const client = clients.find((row) => row.id === measurement.client_id);
            return (
              <article
                key={measurement.id}
                className="space-y-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="text-xl">{JOB_TYPE_EMOJI[measurement.kind]}</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {measurement.label || JOB_TYPE_LABELS[measurement.kind]}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {measurementSummary(measurement.kind, measurement.data)}
                      </p>
                    </div>
                  </div>
                  <Confirm
                    title="Ștergi măsurătoarea?"
                    onConfirm={async () => {
                      await deleteMeasurement(measurement.id);
                      toast.success("Măsurătoare ștearsă");
                    }}
                  >
                    <Button variant="ghost" size="icon-sm" aria-label="Șterge">
                      <Trash2 className="text-red-400" />
                    </Button>
                  </Confirm>
                </div>

                <DerivedPanel kind={measurement.kind} data={measurement.data} />

                {measurement.notes && (
                  <p className="whitespace-pre-wrap rounded-xl bg-background p-3 text-sm text-muted-foreground">
                    {measurement.notes}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>{formatDateShort(measurement.created_at)}</span>
                  {job ? (
                    <Link
                      href={`/lucrari/${job.id}?tab=masuratori`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {job.title} <ExternalLink className="size-3" />
                    </Link>
                  ) : client ? (
                    <Link href={`/clienti/${client.id}`} className="text-primary hover:underline">
                      {client.name}
                    </Link>
                  ) : (
                    <span>Măsurătoare rapidă</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Ruler}
          title="Nicio măsurătoare"
          description="Fă o măsurătoare rapidă de pe telefon, direct de pe șantier."
          action={
            <Button asChild>
              <Link href="/masuratori/nou">
                <Plus /> Măsurătoare nouă
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
