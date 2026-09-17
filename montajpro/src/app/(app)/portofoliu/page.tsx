"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, ImageIcon, Images, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssetImage } from "@/components/photo/asset-image";
import { useJobs, useTable } from "@/hooks/use-data";
import { updateJob } from "@/lib/db/actions";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { JOB_TYPES } from "@/lib/types";
import type { Job, JobType } from "@/lib/types";
import { formatDate } from "@/lib/format";

type Filter = JobType | "all";

/** Portofoliul: lucrările finalizate, cu „înainte” și „după”. */
export default function PortfolioPage() {
  const jobs = useJobs();
  const photos = useTable("job_photos");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Job | null>(null);
  const [description, setDescription] = useState("");

  const entries = useMemo(() => {
    const done = jobs.filter((job) => job.status === "done");
    return done
      .filter((job) => filter === "all" || job.type === filter)
      .map((job) => {
        const jobPhotos = photos.filter((photo) => photo.job_id === job.id);
        return {
          job,
          before: jobPhotos.filter((photo) => photo.stage === "before"),
          after: jobPhotos.filter((photo) => photo.stage === "after"),
          during: jobPhotos.filter((photo) => photo.stage === "during"),
        };
      })
      .sort((a, b) =>
        (b.job.end_date ?? b.job.updated_at).localeCompare(a.job.end_date ?? a.job.updated_at),
      );
  }, [jobs, photos, filter]);

  const counts = useMemo(() => {
    const done = jobs.filter((job) => job.status === "done");
    const result = { all: done.length } as Record<Filter, number>;
    for (const type of JOB_TYPES) {
      result[type] = done.filter((job) => job.type === type).length;
    }
    return result;
  }, [jobs]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Portofoliu"
        description="Lucrările finalizate — dovada meseriei tale"
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

      {entries.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map(({ job, before, after, during }) => (
            <article
              key={job.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="grid grid-cols-2 gap-px bg-border">
                <div className="relative aspect-[4/3] bg-muted">
                  {before[0] ? (
                    <AssetImage
                      storagePath={before[0].storage_path}
                      localKey={before[0].local_key}
                      alt={`Înainte — ${job.title}`}
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <Camera className="size-5" />
                      <span className="text-[10px]">fără „înainte”</span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    ÎNAINTE
                  </span>
                </div>
                <div className="relative aspect-[4/3] bg-muted">
                  {after[0] ? (
                    <AssetImage
                      storagePath={after[0].storage_path}
                      localKey={after[0].local_key}
                      alt={`După — ${job.title}`}
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <Camera className="size-5" />
                      <span className="text-[10px]">fără „după”</span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    DUPĂ
                  </span>
                </div>
              </div>

              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {JOB_TYPE_EMOJI[job.type]} {job.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {JOB_TYPE_LABELS[job.type]} · {formatDate(job.end_date ?? job.updated_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Editează descrierea"
                    onClick={() => {
                      setEditing(job);
                      setDescription(job.portfolio_description ?? "");
                    }}
                  >
                    <Pencil />
                  </Button>
                </div>

                {job.portfolio_description && (
                  <p className="text-sm text-muted-foreground">{job.portfolio_description}</p>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Images className="size-3.5" />
                    {before.length + after.length + during.length} poze
                  </span>
                  <Link
                    href={`/lucrari/${job.id}?tab=poze`}
                    className="text-xs text-primary hover:underline"
                  >
                    Vezi lucrarea
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title="Portofoliu gol"
          description="Finalizează o lucrare și adaugă poze „înainte” și „după” — apar automat aici."
          action={
            <Button asChild variant="outline">
              <Link href="/lucrari">Vezi lucrările</Link>
            </Button>
          }
        />
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descriere pentru portofoliu</DialogTitle>
          </DialogHeader>
          <Field label="Descriere" hint="Ce ai făcut, cu ce materiale, în cât timp">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Scară din stejar masiv, 15 trepte, finisaj ulei natural. Montaj în 2 zile."
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Anulează
            </Button>
            <Button
              onClick={async () => {
                if (editing) {
                  await updateJob(editing.id, { portfolio_description: description.trim() || null });
                  toast.success("Descriere salvată");
                }
                setEditing(null);
              }}
            >
              Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
