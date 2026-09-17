"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DerivedPanel, MeasurementFields } from "@/components/measurements/measurement-fields";
import { PhotoInput } from "@/components/photo/photo-input";
import { AssetImage } from "@/components/photo/asset-image";
import { useClients, useJobs } from "@/hooks/use-data";
import { addPhoto, saveMeasurement } from "@/lib/db/actions";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { JOB_TYPES } from "@/lib/types";
import type { JobType, MeasurementData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Măsurătoare rapidă de pe telefon — minim de tastare, calcule automate. */
export default function NewMeasurementPage() {
  const router = useRouter();
  const clients = useClients();
  const jobs = useJobs();

  const [kind, setKind] = useState<JobType>("stairs");
  const [label, setLabel] = useState("");
  const [data, setData] = useState<MeasurementData>({});
  const [notes, setNotes] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ path: string | null; localKey: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const measurement = await saveMeasurement({
        job_id: jobId,
        client_id: clientId,
        kind,
        label,
        data,
        notes,
      });
      if (measurement) {
        for (const photo of photos) {
          await addPhoto({
            job_id: jobId,
            measurement_id: measurement.id,
            stage: "before",
            storage_path: photo.path,
            local_key: photo.localKey,
          });
        }
      }
      toast.success("Măsurătoare salvată");
      router.replace(jobId ? `/lucrari/${jobId}?tab=masuratori` : "/masuratori");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Măsurătoare nouă" description="Completează doar ce ai măsurat" />

      <form onSubmit={submit} className="space-y-4 pb-4">
        <div className="grid grid-cols-4 gap-2">
          {JOB_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setKind(type)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors",
                kind === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <span className="text-xl">{JOB_TYPE_EMOJI[type]}</span>
              {JOB_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
          <Field label="Etichetă" hint="ex. scara din hol, dormitor 1">
            <Input value={label} onChange={(event) => setLabel(event.target.value)} />
          </Field>
          <MeasurementFields kind={kind} data={data} onChange={setData} />
        </div>

        <DerivedPanel kind={kind} data={data} />

        <div className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
          <Field label="Leagă de lucrare" hint="Opțional">
            <Select
              value={jobId ?? "none"}
              onValueChange={(value) => setJobId(value === "none" ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Fără lucrare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Fără lucrare</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Client" hint="Opțional">
            <Select
              value={clientId ?? "none"}
              onValueChange={(value) => setClientId(value === "none" ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Fără client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Fără client</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Observații">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Perete strâmb, prag înalt, acces dificil..."
            />
          </Field>

          <Field label="Fotografii">
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div
                  key={photo.localKey}
                  className="aspect-square overflow-hidden rounded-xl border border-border"
                >
                  <AssetImage
                    storagePath={photo.path}
                    localKey={photo.localKey}
                    alt="Fotografie măsurătoare"
                  />
                </div>
              ))}
              <PhotoInput
                folder="measurements"
                multiple
                label="Poză"
                onCaptured={(asset) =>
                  setPhotos((current) => [
                    ...current,
                    { path: asset.storage_path, localKey: asset.local_key },
                  ])
                }
              />
            </div>
          </Field>
        </div>

        <div className="sticky bottom-[calc(var(--bottom-nav-h)+0.75rem)] z-10 flex gap-2 lg:static">
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="flex-1"
            onClick={() => router.back()}
          >
            Anulează
          </Button>
          <Button type="submit" size="xl" className="flex-[2]" loading={saving}>
            <Check /> Salvează
          </Button>
        </div>
      </form>
    </div>
  );
}
