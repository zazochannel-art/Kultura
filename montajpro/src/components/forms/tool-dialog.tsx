"use client";

import { useState } from "react";
import { X } from "lucide-react";
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
import { PhotoInput } from "@/components/photo/photo-input";
import { AssetImage } from "@/components/photo/asset-image";
import { useZodForm } from "@/hooks/use-zod-form";
import { toolSchema } from "@/lib/schemas";
import { saveTool } from "@/lib/db/actions";
import type { Tool } from "@/lib/types";
import { useApp } from "@/lib/app-provider";

export function ToolDialog({
  open,
  onOpenChange,
  tool,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool?: Tool | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ToolForm tool={tool} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

/** Montat abia la deschidere, deci pornește din valorile sculei. */
function ToolForm({
  tool,
  onOpenChange,
}: {
  tool?: Tool | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { currency } = useApp();
  const [photo, setPhoto] = useState<{
    path: string | null;
    localKey: string | null;
  }>({
    path: tool?.photo_path ?? null,
    localKey: tool?.photo_local_key ?? null,
  });

  const form = useZodForm(toolSchema, {
    name: tool?.name ?? "",
    brand: tool?.brand ?? "",
    model: tool?.model ?? "",
    price: tool?.price ?? 0,
    purchased_at: tool?.purchased_at ?? "",
    warranty_months: tool?.warranty_months ?? 24,
    notes: tool?.notes ?? "",
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await saveTool({
      id: tool?.id,
      ...data,
      photo_path: photo.path,
      photo_local_key: photo.localKey,
    });
    toast.success(tool ? "Sculă actualizată" : "Sculă adăugată");
    onOpenChange(false);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{tool ? "Editează scula" : "Sculă nouă"}</DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <Field label="Nume" error={form.errors.name} required>
          <Input
            autoFocus
            value={form.values.name}
            onChange={(event) => form.set("name", event.target.value)}
            placeholder="Ferăstrău circular"
          />
        </Field>

        <FieldRow>
          <Field label="Brand">
            <Input
              value={form.values.brand ?? ""}
              onChange={(event) => form.set("brand", event.target.value)}
              placeholder="Makita"
            />
          </Field>
          <Field label="Model">
            <Input
              value={form.values.model ?? ""}
              onChange={(event) => form.set("model", event.target.value)}
              placeholder="HS7601"
            />
          </Field>
        </FieldRow>

        <Field label="Preț">
          <MoneyInput
            value={form.values.price ?? 0}
            onChange={(value) => form.set("price", value)}
            currency={currency}
          />
        </Field>

        <FieldRow>
          <Field label="Data cumpărării">
            <Input
              type="date"
              value={form.values.purchased_at ?? ""}
              onChange={(event) => form.set("purchased_at", event.target.value)}
            />
          </Field>
          <Field label="Garanție (luni)">
            <NumberInput
              value={form.values.warranty_months ?? 0}
              onChange={(value) => form.set("warranty_months", value)}
              step={6}
              stepper={false}
              suffix="luni"
            />
          </Field>
        </FieldRow>

        <Field label="Fotografie">
          {photo.localKey || photo.path ? (
            <div className="relative h-32 w-full overflow-hidden rounded-xl border border-border">
              <AssetImage
                storagePath={photo.path}
                localKey={photo.localKey}
                alt="Sculă"
                className="object-contain"
              />
              <button
                type="button"
                onClick={() => setPhoto({ path: null, localKey: null })}
                className="absolute right-2 top-2 rounded-lg bg-black/70 p-1.5 text-white"
                aria-label="Elimină poza"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <PhotoInput
              folder="tools"
              variant="button"
              label="Fotografiază scula"
              onCaptured={(asset) =>
                setPhoto({
                  path: asset.storage_path,
                  localKey: asset.local_key,
                })
              }
            />
          )}
        </Field>

        <Field label="Notițe">
          <Textarea
            value={form.values.notes ?? ""}
            onChange={(event) => form.set("notes", event.target.value)}
            placeholder="Unde e păstrată, ce accesorii are..."
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
