"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { useZodForm } from "@/hooks/use-zod-form";
import { clientSchema } from "@/lib/schemas";
import { saveClient } from "@/lib/db/actions";
import type { Client } from "@/lib/types";

export function ClientDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSaved?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ClientForm
          client={client}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Conținutul dialogului este montat abia la deschidere, deci starea pornește
 * de fiecare dată din valorile clientului — fără sincronizări prin efecte.
 */
function ClientForm({
  client,
  onOpenChange,
  onSaved,
}: {
  client?: Client | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const form = useZodForm(clientSchema, {
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    address: client?.address ?? "",
    notes: client?.notes ?? "",
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const saved = await saveClient({ id: client?.id, ...data });
    toast.success(client ? "Client actualizat" : "Client adăugat");
    onOpenChange(false);
    if (saved) onSaved?.(saved.id);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{client ? "Editează clientul" : "Client nou"}</DialogTitle>
        <DialogDescription>
          Numele este suficient ca să începi — restul se poate completa mai
          târziu.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <Field
          label="Nume"
          htmlFor="client-name"
          error={form.errors.name}
          required
        >
          <Input
            id="client-name"
            autoFocus
            value={form.values.name}
            onChange={(event) => form.set("name", event.target.value)}
            placeholder="Ion Popescu"
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label="Telefon"
            htmlFor="client-phone"
            error={form.errors.phone}
          >
            <Input
              id="client-phone"
              type="tel"
              inputMode="tel"
              value={form.values.phone ?? ""}
              onChange={(event) => form.set("phone", event.target.value)}
              placeholder="+373 69 123 456"
            />
          </Field>
          <Field label="Email" htmlFor="client-email" error={form.errors.email}>
            <Input
              id="client-email"
              type="email"
              inputMode="email"
              value={form.values.email ?? ""}
              onChange={(event) => form.set("email", event.target.value)}
              placeholder="ion@exemplu.md"
            />
          </Field>
        </div>

        <Field
          label="Adresă"
          htmlFor="client-address"
          error={form.errors.address}
        >
          <Input
            id="client-address"
            value={form.values.address ?? ""}
            onChange={(event) => form.set("address", event.target.value)}
            placeholder="str. Ismail 45, Chișinău"
          />
        </Field>

        <Field label="Notițe" htmlFor="client-notes">
          <Textarea
            id="client-notes"
            value={form.values.notes ?? ""}
            onChange={(event) => form.set("notes", event.target.value)}
            placeholder="Preferă lucrul în weekend, are câine în curte..."
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
            {client ? "Salvează" : "Adaugă client"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
