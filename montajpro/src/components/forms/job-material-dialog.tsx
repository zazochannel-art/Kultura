"use client";

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
import { Field, FieldRow } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useZodForm } from "@/hooks/use-zod-form";
import { jobMaterialSchema } from "@/lib/schemas";
import { saveJobMaterial } from "@/lib/db/actions";
import { UNITS } from "@/lib/constants";
import type { JobMaterial } from "@/lib/types";
import { useApp } from "@/lib/app-provider";
import { useTable } from "@/hooks/use-data";

/** Adaugă un material la o lucrare, opțional preluat din inventar. */
export function JobMaterialDialog({
  open,
  onOpenChange,
  jobId,
  material,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  material?: JobMaterial | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <JobMaterialForm
          jobId={jobId}
          material={material}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Montat abia la deschidere, deci pornește din valorile materialului. */
function JobMaterialForm({
  jobId,
  material,
  onOpenChange,
}: {
  jobId: string;
  material?: JobMaterial | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { currency } = useApp();
  const inventory = useTable("materials");

  const form = useZodForm(jobMaterialSchema, {
    name: material?.name ?? "",
    quantity: material?.quantity ?? 1,
    unit: material?.unit ?? "buc",
    unit_price: material?.unit_price ?? 0,
    purchased: material?.purchased ?? false,
    material_id: material?.material_id ?? null,
  });
  const { setValues } = form;

  const pickFromInventory = (id: string) => {
    if (id === "none") {
      form.set("material_id", null);
      return;
    }
    const found = inventory.find((item) => item.id === id);
    if (!found) return;
    setValues((current) => ({
      ...current,
      material_id: found.id,
      name: found.name,
      unit: found.unit,
      unit_price: found.price,
    }));
  };

  const onSubmit = form.handleSubmit(async (data) => {
    await saveJobMaterial({ id: material?.id, job_id: jobId, ...data });
    toast.success("Material salvat");
    onOpenChange(false);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {material ? "Editează materialul" : "Adaugă material"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-3.5">
        {inventory.length > 0 && !material && (
          <Field
            label="Din inventar"
            hint="Completează automat numele și prețul"
          >
            <Select
              value={form.values.material_id ?? "none"}
              onValueChange={pickFromInventory}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alege din inventar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Introdu manual</SelectItem>
                {inventory.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Material" error={form.errors.name} required>
          <Input
            value={form.values.name}
            onChange={(event) => form.set("name", event.target.value)}
            placeholder="Adeziv parchet"
          />
        </Field>

        <FieldRow>
          <Field label="Cantitate" error={form.errors.quantity}>
            <NumberInput
              value={form.values.quantity}
              onChange={(value) => form.set("quantity", value)}
              stepper={false}
              suffix={form.values.unit}
            />
          </Field>
          <Field label="Unitate">
            <Select
              value={form.values.unit}
              onValueChange={(value) => form.set("unit", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>

        <Field label="Preț pe unitate" error={form.errors.unit_price}>
          <MoneyInput
            value={form.values.unit_price}
            onChange={(value) => form.set("unit_price", value)}
            currency={currency}
          />
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
          <div>
            <p className="text-sm font-medium">Cumpărat</p>
            <p className="text-xs text-muted-foreground">
              Bifează când materialul e în mașină
            </p>
          </div>
          <Switch
            checked={form.values.purchased}
            onCheckedChange={(checked) => form.set("purchased", checked)}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Anulează
          </Button>
          <Button type="submit" loading={form.submitting}>
            Salvează
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
