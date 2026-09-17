"use client";

import { useState } from "react";
import { Plus, Receipt, Trash2, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { PaymentDialog } from "@/components/forms/payment-dialog";
import { ExpenseDialog } from "@/components/forms/expense-dialog";
import { deletePayment, deleteExpense } from "@/lib/db/actions";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { formatDateShort, formatMoney, formatPercent } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import type { Expense, Job, Payment } from "@/lib/types";
import type { JobMoney } from "@/lib/calc";
import { cn } from "@/lib/utils";

/** Toți banii lucrării: preț, încasări, costuri, profit. */
export function FinanceTab({
  job,
  money,
  payments,
  expenses,
}: {
  job: Job;
  money: JobMoney;
  payments: Payment[];
  expenses: Expense[];
}) {
  const { currency } = useApp();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const rows = [
    { label: "Preț lucrare", value: money.price, tone: "" },
    { label: "Avans", value: money.advance, tone: "text-emerald-300" },
    { label: "Total încasat", value: money.paid, tone: "text-emerald-300" },
    { label: "Rest de plată", value: money.rest, tone: "text-amber-300" },
    {
      label: "Cost materiale",
      value: -money.materialsCost,
      tone: "text-red-300",
    },
    {
      label: "Alte cheltuieli",
      value: -money.expensesCost,
      tone: "text-red-300",
    },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <dl className="space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className={cn("font-semibold tabular-nums", row.tone)}>
                {formatMoney(row.value, currency)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-background p-3.5">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5" /> Profit estimat
            </p>
            <p className="text-xs text-muted-foreground">
              marjă {formatPercent(money.margin)}
            </p>
          </div>
          <p
            className={cn(
              "text-xl font-bold tabular-nums",
              money.profit >= 0 ? "text-emerald-300" : "text-red-300",
            )}
          >
            {formatMoney(money.profit, currency)}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Plăți primite</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingPayment(null);
              setPaymentOpen(true);
            }}
          >
            <Plus /> Plată
          </Button>
        </div>

        {payments.length ? (
          <ul className="space-y-2">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
                  <Wallet className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {formatMoney(payment.amount, currency)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {PAYMENT_KIND_LABELS[payment.kind]} ·{" "}
                    {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                    {formatDateShort(payment.paid_at)}
                    {payment.note && ` · ${payment.note}`}
                  </p>
                </div>
                <Confirm
                  title="Ștergi plata?"
                  onConfirm={async () => {
                    await deletePayment(payment.id);
                    toast.success("Plată ștearsă");
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Șterge plata"
                  >
                    <Trash2 className="text-red-400" />
                  </Button>
                </Confirm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nicio plată înregistrată
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cheltuieli</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpenseOpen(true)}
          >
            <Plus /> Cheltuială
          </Button>
        </div>

        {expenses.length ? (
          <ul className="space-y-2">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-300">
                  <Receipt className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {formatMoney(expense.amount, currency)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {EXPENSE_CATEGORY_LABELS[expense.category]} ·{" "}
                    {formatDateShort(expense.spent_at)}
                    {expense.note && ` · ${expense.note}`}
                  </p>
                </div>
                <Confirm
                  title="Ștergi cheltuiala?"
                  onConfirm={async () => {
                    await deleteExpense(expense.id);
                    toast.success("Cheltuială ștearsă");
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Șterge cheltuiala"
                  >
                    <Trash2 className="text-red-400" />
                  </Button>
                </Confirm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nicio cheltuială pe această lucrare
          </p>
        )}
      </section>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        jobId={job.id}
        clientId={job.client_id}
        payment={editingPayment}
        suggestedAmount={Math.max(0, money.rest)}
      />
      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        defaultJobId={job.id}
      />
    </div>
  );
}
