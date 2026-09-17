"use client";

import { useState } from "react";
import { Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { MeasurementDialog } from "@/components/measurements/measurement-dialog";
import { DerivedPanel } from "@/components/measurements/measurement-fields";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { deleteMeasurement } from "@/lib/db/actions";
import { formatDateShort } from "@/lib/format";
import type { Job, JobMeasurement } from "@/lib/types";

export function MeasurementsTab({
  job,
  measurements,
}: {
  job: Job;
  measurements: JobMeasurement[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobMeasurement | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="space-y-3">
      {measurements.length ? (
        <>
          {measurements.map((measurement) => (
            <article
              key={measurement.id}
              className="space-y-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">
                    {JOB_TYPE_EMOJI[measurement.kind]}
                  </span>
                  <div>
                    <p className="font-semibold">
                      {measurement.label || JOB_TYPE_LABELS[measurement.kind]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(measurement.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Editează"
                    onClick={() => {
                      setEditing(measurement);
                      setOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
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
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                {Object.entries(measurement.data)
                  .filter(
                    ([, value]) =>
                      value !== "" && value !== null && value !== undefined,
                  )
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs text-muted-foreground">
                        {FIELD_LABELS[key] ?? key}
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {String(value)}
                      </dd>
                    </div>
                  ))}
              </dl>

              <DerivedPanel kind={measurement.kind} data={measurement.data} />

              {measurement.notes && (
                <p className="whitespace-pre-wrap rounded-xl bg-background p-3 text-sm text-muted-foreground">
                  {measurement.notes}
                </p>
              )}
            </article>
          ))}
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={openNew}
          >
            <Plus /> Adaugă măsurătoare
          </Button>
        </>
      ) : (
        <EmptyState
          icon={Ruler}
          title="Nicio măsurătoare"
          description="Notează dimensiunile direct de pe șantier — calculele se fac automat."
          action={
            <Button onClick={openNew}>
              <Plus /> Adaugă măsurătoare
            </Button>
          }
        />
      )}

      <MeasurementDialog
        open={open}
        onOpenChange={setOpen}
        jobId={job.id}
        defaultKind={job.type}
        measurement={editing}
      />
    </div>
  );
}

/** Etichete lizibile pentru cheile brute din JSON. */
const FIELD_LABELS: Record<string, string> = {
  steps: "Trepte",
  width: "Lățime (cm)",
  length: "Lungime (cm)",
  height: "Înălțime (cm)",
  depth: "Adâncime (cm)",
  thickness: "Grosime (cm)",
  landings: "Podeste",
  angle: "Unghi (°)",
  radius: "Rază (cm)",
  area: "Suprafață (m²)",
  parquet_type: "Tip parchet",
  waste_percent: "Pierdere (%)",
  rooms: "Camere",
  linear_meters: "Metri liniari",
  plinth_type: "Tip plintă",
  corners_outer: "Colțuri ext.",
  corners_inner: "Colțuri int.",
  profiles: "Profile",
  joints: "Îmbinări",
  piece_length: "Lungime bucată (m)",
  quantity: "Cantitate",
  unit: "Unitate",
  label: "Denumire",
};
