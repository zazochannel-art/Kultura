"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { JobForm } from "@/components/jobs/job-form";
import { useRow, useStoreReady } from "@/hooks/use-data";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ready = useStoreReady();
  const job = useRow("jobs", id);

  if (!ready) return <Skeleton className="h-96 w-full" />;
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Editează lucrarea" description={job.title} />
      <JobForm job={job} />
    </div>
  );
}
