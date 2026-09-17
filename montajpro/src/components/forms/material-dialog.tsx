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
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useZodForm } from "@/hooks/use-zod-form";
import { materialSchema } from "@/lib/schemas";
import { saveMaterial } from "@/lib/db/actions";
import { DEFAULT_MATERIAL_CATEGORIES, UNITS } from "@/lib/constants";
import type { Material } from "@/lib/types";
import { useApp } from "@/lib/app-provider";

export function MaterialDialog({
  open,
  onOpenChange,
  material,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: Material | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <MaterialForm material={material} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

/** Montat abia la deschidere, deci pornește din valorile materialului. */
function MaterialForm({
  material,
  onOpenChange,
}: {
  material?: Material | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { currency, settings } = useApp();
  const categories = settings?.material_categories?.length
    ? settings.material_categories
    : DEFAULT_MATERIAL_CATEGORIES;

  const form = useZodForm(materialSchema, {
    name: material?.name ?? "",
    category: material?.category ?? categories[0] ?? "Altele",
    quantity: material?.quantity ?? 0,
    unit: material?.unit ?? "buc",
    price: material?.price ?? 0,
    supplier: material?.supplier ?? "",
    notes: material?.notes ?? "",
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await saveMaterial({ id: material?.id, ...data });
    toast.success(material ? "Material actualizat" : "Material adăugat");
    onOpenChange(false);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {material ? "Editează materialul" : "Material nou"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <Field label="Nume" error={form.errors.name} required>
          <Input
            autoFocus
            value={form.values.name}
            onChange={(event) => form.set("name", event.target.value)}
            placeholder="Parchet stejar 14mm"
          />
        </Field>

        <FieldRow>
          <Field label="Categorie">
            <Select
              value={form.values.category ?? ""}
              onValueChange={(value) => form.set("category", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        <Field label="Cantitate în stoc" error={form.errors.quantity}>
          <NumberInput
            value={form.values.quantity}
            onChange={(value) => form.set("quantity", value)}
            suffix={form.values.unit}
          />
        </Field>

        <Field label="Preț pe unitate" error={form.errors.price}>
          <MoneyInput
            value={form.values.price}
            onChange={(value) => form.set("price", value)}
            currency={currency}
          />
        </Field>

        <Field label="Furnizor">
          <Input
            value={form.values.supplier ?? ""}
            onChange={(event) => form.set("supplier", event.target.value)}
            placeholder="Depozit Supraten"
          />
        </Field>

        <Field label="Notițe">
          <Textarea
            value={form.values.notes ?? ""}
            onChange={(event) => form.set("notes", event.target.value)}
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
          <Button type="submit" loading={form.submitting}>
            Salvează
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
