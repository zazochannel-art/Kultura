"use client";

import { useState } from "react";
import { Receipt, X } from "lucide-react";
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
import { PhotoInput } from "@/components/photo/photo-input";
import { AssetImage } from "@/components/photo/asset-image";
import { useZodForm } from "@/hooks/use-zod-form";
import { expenseSchema } from "@/lib/schemas";
import { saveExpense } from "@/lib/db/actions";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { useApp } from "@/lib/app-provider";
import { useJobs } from "@/hooks/use-data";
import { todayKey } from "@/lib/format";

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  defaultJobId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  defaultJobId?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ExpenseForm
          expense={expense}
          defaultJobId={defaultJobId}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Montat abia la deschidere, deci pornește din valorile cheltuielii. */
function ExpenseForm({
  expense,
  defaultJobId,
  onOpenChange,
}: {
  expense?: Expense | null;
  defaultJobId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { currency } = useApp();
  const jobs = useJobs();
  const [receipt, setReceipt] = useState<{
    path: string | null;
    localKey: string | null;
  }>({
    path: expense?.receipt_path ?? null,
    localKey: expense?.receipt_local_key ?? null,
  });

  const form = useZodForm(expenseSchema, {
    amount: expense?.amount ?? 0,
    category: (expense?.category ?? "materials") as ExpenseCategory,
    spent_at: expense?.spent_at ?? todayKey(),
    job_id: expense?.job_id ?? defaultJobId,
    note: expense?.note ?? "",
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await saveExpense({
      id: expense?.id,
      ...data,
      job_id: data.job_id ?? null,
      receipt_path: receipt.path,
      receipt_local_key: receipt.localKey,
    });
    toast.success("Cheltuială salvată");
    onOpenChange(false);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {expense ? "Editează cheltuiala" : "Cheltuială nouă"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <Field
          label="Sumă"
          htmlFor="expense-amount"
          error={form.errors.amount}
          required
        >
          <MoneyInput
            id="expense-amount"
            value={form.values.amount}
            onChange={(value) => form.set("amount", value)}
            currency={currency}
          />
        </Field>

        <FieldRow>
          <Field label="Categorie">
            <Select
              value={form.values.category}
              onValueChange={(value) =>
                form.set("category", value as ExpenseCategory)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {EXPENSE_CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data" error={form.errors.spent_at}>
            <Input
              type="date"
              value={form.values.spent_at}
              onChange={(event) => form.set("spent_at", event.target.value)}
            />
          </Field>
        </FieldRow>

        <Field label="Lucrare" hint="Opțional — leagă cheltuiala de o lucrare">
          <Select
            value={form.values.job_id ?? "none"}
            onValueChange={(value) =>
              form.set("job_id", value === "none" ? null : value)
            }
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

        <Field label="Notă">
          <Input
            value={form.values.note ?? ""}
            onChange={(event) => form.set("note", event.target.value)}
            placeholder="ex. adeziv + spumă"
          />
        </Field>

        <Field label="Bon fiscal">
          {receipt.localKey || receipt.path ? (
            <div className="relative h-32 w-full overflow-hidden rounded-xl border border-border">
              <AssetImage
                storagePath={receipt.path}
                localKey={receipt.localKey}
                alt="Bon fiscal"
                className="object-contain"
              />
              <button
                type="button"
                onClick={() => setReceipt({ path: null, localKey: null })}
                className="absolute right-2 top-2 rounded-lg bg-black/70 p-1.5 text-white"
                aria-label="Elimină bonul"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <PhotoInput
              folder="receipts"
              variant="button"
              label="Fotografiază bonul"
              onCaptured={(asset) =>
                setReceipt({
                  path: asset.storage_path,
                  localKey: asset.local_key,
                })
              }
            />
          )}
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
            <Receipt /> Salvează
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
