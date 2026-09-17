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
import { Field, FieldRow } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useZodForm } from "@/hooks/use-zod-form";
import { paymentSchema } from "@/lib/schemas";
import { addPayment } from "@/lib/db/actions";
import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { PAYMENT_KINDS, PAYMENT_METHODS } from "@/lib/types";
import type { Payment, PaymentKind, PaymentMethod } from "@/lib/types";
import { useApp } from "@/lib/app-provider";
import { useJobs } from "@/hooks/use-data";
import { todayKey } from "@/lib/format";

export function PaymentDialog({
  open,
  onOpenChange,
  jobId,
  clientId,
  payment,
  suggestedAmount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = plată liberă: dialogul cere lucrarea. */
  jobId: string | null;
  clientId: string | null;
  payment?: Payment | null;
  suggestedAmount?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <PaymentForm
          jobId={jobId}
          clientId={clientId}
          payment={payment}
          suggestedAmount={suggestedAmount}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  jobId,
  clientId,
  payment,
  suggestedAmount,
  onOpenChange,
}: {
  jobId: string | null;
  clientId: string | null;
  payment?: Payment | null;
  suggestedAmount?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { currency } = useApp();
  const jobs = useJobs();
  const [selectedJob, setSelectedJob] = useState<string | null>(
    jobId ?? payment?.job_id ?? null,
  );

  const form = useZodForm(paymentSchema, {
    amount: payment?.amount ?? suggestedAmount ?? 0,
    kind: (payment?.kind ?? "partial") as PaymentKind,
    method: (payment?.method ?? "cash") as PaymentMethod,
    paid_at: payment?.paid_at ?? todayKey(),
    note: payment?.note ?? "",
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const job = jobs.find((row) => row.id === selectedJob);
    await addPayment({
      id: payment?.id,
      job_id: selectedJob,
      client_id: job?.client_id ?? clientId,
      ...data,
    });
    toast.success("Plată înregistrată");
    onOpenChange(false);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{payment ? "Editează plata" : "Adaugă plată"}</DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-3.5">
        {!jobId && (
          <Field label="Lucrare" hint="Opțional — leagă plata de o lucrare">
            <Select
              value={selectedJob ?? "none"}
              onValueChange={(value) =>
                setSelectedJob(value === "none" ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Fără lucrare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Fără lucrare</SelectItem>
                {jobs.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field
          label="Sumă"
          htmlFor="payment-amount"
          error={form.errors.amount}
          required
        >
          <MoneyInput
            id="payment-amount"
            value={form.values.amount}
            onChange={(value) => form.set("amount", value)}
            currency={currency}
          />
        </Field>

        <FieldRow>
          <Field label="Tip">
            <Select
              value={form.values.kind}
              onValueChange={(value) => form.set("kind", value as PaymentKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {PAYMENT_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Metodă">
            <Select
              value={form.values.method}
              onValueChange={(value) =>
                form.set("method", value as PaymentMethod)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>

        <Field label="Data" error={form.errors.paid_at} required>
          <Input
            type="date"
            value={form.values.paid_at}
            onChange={(event) => form.set("paid_at", event.target.value)}
          />
        </Field>

        <Field label="Notă">
          <Input
            value={form.values.note ?? ""}
            onChange={(event) => form.set("note", event.target.value)}
            placeholder="ex. avans la semnare"
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
