"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { saveMeasurement } from "@/lib/db/actions";
import { JOB_TYPE_LABELS } from "@/lib/constants";
import { JOB_TYPES } from "@/lib/types";
import type { JobMeasurement, JobType, MeasurementData } from "@/lib/types";
import { DerivedPanel, MeasurementFields } from "./measurement-fields";

/** Adaugă sau editează o măsurătoare din pagina lucrării. */
export function MeasurementDialog({
  open,
  onOpenChange,
  jobId,
  defaultKind = "stairs",
  measurement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  defaultKind?: JobType;
  measurement?: JobMeasurement | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <MeasurementForm
          jobId={jobId}
          defaultKind={defaultKind}
          measurement={measurement}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Montat abia la deschidere, deci pornește din valorile măsurătorii. */
function MeasurementForm({
  jobId,
  defaultKind,
  measurement,
  onOpenChange,
}: {
  jobId: string;
  defaultKind: JobType;
  measurement?: JobMeasurement | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<JobType>(measurement?.kind ?? defaultKind);
  const [label, setLabel] = useState(measurement?.label ?? "");
  const [notes, setNotes] = useState(measurement?.notes ?? "");
  const [data, setData] = useState<MeasurementData>(measurement?.data ?? {});
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveMeasurement({
        id: measurement?.id,
        job_id: jobId,
        kind,
        label,
        data,
        notes,
      });
      toast.success("Măsurătoare salvată");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {measurement ? "Editează măsurătoarea" : "Măsurătoare nouă"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Tip">
          <Select
            value={kind}
            onValueChange={(value) => setKind(value as JobType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {JOB_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Etichetă" hint="ex. scara principală, dormitor mare">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>

        <MeasurementFields kind={kind} data={data} onChange={setData} />
        <DerivedPanel kind={kind} data={data} />

        <Field label="Observații">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Perete strâmb, prag înalt, necesită tăiere pe loc..."
          />
        </Field>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Anulează
          </Button>
          <Button type="submit" loading={saving}>
            Salvează
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
