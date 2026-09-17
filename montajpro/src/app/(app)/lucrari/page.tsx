"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Hammer, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients, useJobs, useStoreReady } from "@/hooks/use-data";
import { JOB_STATUS_LABELS } from "@/lib/constants";
import { JOB_STATUSES } from "@/lib/types";
import type { JobStatus } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useApp } from "@/lib/app-provider";

type Filter = JobStatus | "all";

function JobsList() {
  const searchParams = useSearchParams();
  const ready = useStoreReady();
  const jobs = useJobs();
  const clients = useClients();
  const { currency } = useApp();

  const initialFilter = (searchParams.get("filtru") as Filter) || "all";
  const [filter, setFilter] = useState<Filter>(
    JOB_STATUSES.includes(initialFilter as JobStatus) ? initialFilter : "all",
  );
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const result = { all: jobs.length } as Record<Filter, number>;
    for (const status of JOB_STATUSES) {
      result[status] = jobs.filter((job) => job.status === status).length;
    }
    return result;
  }, [jobs]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (filter !== "all" && job.status !== filter) return false;
      if (!needle) return true;
      const clientName =
        clients.find((client) => client.id === job.client_id)?.name.toLowerCase() ?? "";
      return (
        job.title.toLowerCase().includes(needle) ||
        clientName.includes(needle) ||
        (job.address ?? "").toLowerCase().includes(needle)
      );
    });
  }, [jobs, clients, filter, query]);

  const totals = useMemo(
    () => filtered.reduce((acc, job) => acc + job.price_total, 0),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lucrări"
        description={
          filtered.length
            ? `${filtered.length} lucrări · ${formatMoney(totals, currency)}`
            : "Toate comenzile tale"
        }
        action={
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/lucrari/nou">
              <Plus /> Lucrare nouă
            </Link>
          </Button>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Caută după client, titlu sau adresă"
          className="pl-10"
          type="search"
        />
      </div>

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Toate", count: counts.all },
          ...JOB_STATUSES.map((status) => ({
            value: status as Filter,
            label: JOB_STATUS_LABELS[status],
            count: counts[status],
          })),
        ]}
      />

      {!ready ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-36 w-full" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Hammer}
          title={query || filter !== "all" ? "Nicio lucrare găsită" : "Nicio lucrare încă"}
          description={
            query || filter !== "all"
              ? "Încearcă alt filtru sau altă căutare."
              : "Adaugă prima lucrare și ține totul într-un singur loc."
          }
          action={
            <Button asChild>
              <Link href="/lucrari/nou">
                <Plus /> Lucrare nouă
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <JobsList />
    </Suspense>
  );
}
