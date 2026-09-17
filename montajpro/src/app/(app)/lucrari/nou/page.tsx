"use client";

import { PageHeader } from "@/components/layout/page-header";
import { JobForm } from "@/components/jobs/job-form";

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Lucrare nouă"
        description="Completează ce știi acum — restul se poate adăuga pe parcurs."
      />
      <JobForm />
    </div>
  );
}
