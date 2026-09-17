"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Hammer,
  Pencil,
  Printer,
  Send,
  Share2,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { useRow, useStoreReady, useTable } from "@/hooks/use-data";
import {
  convertQuoteToJob,
  deleteQuote,
  quoteTotal,
  setQuoteStatus,
} from "@/lib/db/actions";
import { QUOTE_STATUS_CLASSES, QUOTE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatMoney, formatNumber, formatQuoteNumber } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { cn } from "@/lib/utils";

/** Oferta, în forma în care o vede clientul (și în care se printează). */
export default function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const ready = useStoreReady();
  const { currency, settings } = useApp();
  const quote = useRow("quotes", id);
  const allItems = useTable("quote_items");
  const client = useRow("clients", quote?.client_id);

  const items = useMemo(
    () =>
      allItems
        .filter((item) => item.quote_id === id)
        .sort((a, b) => a.position - b.position),
    [allItems, id],
  );

  if (!ready) return <Skeleton className="h-96 w-full" />;
  if (!quote) notFound();

  const { subtotal, total } = quoteTotal(items, quote.discount);
  const rest = total - quote.advance;

  const share = async () => {
    const lines = [
      `OFERTĂ ${formatQuoteNumber(quote.number)}`,
      client ? `Client: ${client.name}` : null,
      `Lucrare: ${quote.title}`,
      "",
      ...items.map(
        (item) =>
          `${item.description}: ${formatNumber(item.quantity)} ${item.unit} × ${formatMoney(item.unit_price, currency)} = ${formatMoney(item.quantity * item.unit_price, currency)}`,
      ),
      "",
      `TOTAL: ${formatMoney(total, currency)}`,
      quote.advance ? `AVANS: ${formatMoney(quote.advance, currency)}` : null,
      quote.advance ? `REST: ${formatMoney(rest, currency)}` : null,
      quote.notes ? `\n${quote.notes}` : null,
      settings?.full_name ? `\n${settings.full_name}` : null,
      settings?.phone ?? null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: `Ofertă ${formatQuoteNumber(quote.number)}`, text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        toast.success("Oferta a fost copiată");
      }
    } catch {
      // Utilizatorul a anulat partajarea — nu e o eroare.
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium",
            QUOTE_STATUS_CLASSES[quote.status],
          )}
        >
          {QUOTE_STATUS_LABELS[quote.status]}
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={share}>
          <Share2 /> Trimite
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer /> Printează
        </Button>
      </div>

      {/* Documentul propriu-zis */}
      <article className="print-surface space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              OFERTĂ {formatQuoteNumber(quote.number)}
            </h2>
            <p className="text-sm text-muted-foreground">{formatDate(quote.created_at)}</p>
            {quote.valid_until && (
              <p className="text-sm text-muted-foreground">
                Valabilă până la {formatDate(quote.valid_until)}
              </p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{settings?.company || settings?.full_name || "MontajPro"}</p>
            {settings?.phone && <p className="text-muted-foreground">{settings.phone}</p>}
            {settings?.email && <p className="text-muted-foreground">{settings.email}</p>}
          </div>
        </header>

        <div className="grid gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">Client: </span>
            <span className="font-medium">{client?.name ?? "—"}</span>
          </p>
          {client?.phone && (
            <p>
              <span className="text-muted-foreground">Telefon: </span>
              {client.phone}
            </p>
          )}
          {client?.address && (
            <p>
              <span className="text-muted-foreground">Adresă: </span>
              {client.address}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Lucrare: </span>
            <span className="font-medium">{quote.title}</span>
          </p>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(item.quantity)} {item.unit} × {formatMoney(item.unit_price, currency)}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatMoney(item.quantity * item.unit_price, currency)}
              </p>
            </div>
          ))}
        </div>

        <dl className="space-y-1.5 text-sm">
          {quote.discount > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reducere</dt>
                <dd className="tabular-nums">−{formatMoney(quote.discount, currency)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
            <dt>TOTAL</dt>
            <dd className="tabular-nums">{formatMoney(total, currency)}</dd>
          </div>
          {quote.advance > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">AVANS</dt>
                <dd className="tabular-nums">{formatMoney(quote.advance, currency)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>REST</dt>
                <dd className="tabular-nums">{formatMoney(rest, currency)}</dd>
              </div>
            </>
          )}
        </dl>

        {(quote.notes || settings?.quote_terms) && (
          <div className="border-t border-border pt-4 text-sm text-muted-foreground">
            {quote.notes && <p className="whitespace-pre-wrap">{quote.notes}</p>}
            {settings?.quote_terms && (
              <p className="mt-2 whitespace-pre-wrap">{settings.quote_terms}</p>
            )}
          </div>
        )}

        {quote.status === "sent" && (
          <p className="rounded-xl bg-background p-3 text-center text-sm text-muted-foreground">
            Status: În așteptarea confirmării
          </p>
        )}
      </article>

      <div className="no-print space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {quote.status !== "sent" && quote.status !== "accepted" && (
            <Button
              onClick={async () => {
                await setQuoteStatus(quote.id, "sent");
                toast.success("Marcată ca trimisă");
              }}
            >
              <Send /> Marchează trimisă
            </Button>
          )}
          {quote.status !== "accepted" && (
            <Button
              variant="success"
              onClick={async () => {
                await setQuoteStatus(quote.id, "accepted");
                toast.success("Ofertă acceptată");
              }}
            >
              <CheckCircle2 /> Acceptată
            </Button>
          )}
          {quote.status !== "rejected" && (
            <Button
              variant="outline"
              onClick={async () => {
                await setQuoteStatus(quote.id, "rejected");
                toast.success("Ofertă refuzată");
              }}
            >
              <XCircle /> Refuzată
            </Button>
          )}
          {!quote.job_id && (
            <Button
              variant="secondary"
              onClick={async () => {
                const job = await convertQuoteToJob(quote.id);
                if (job) {
                  toast.success("Lucrare creată din ofertă");
                  router.push(`/lucrari/${job.id}`);
                }
              }}
            >
              <Hammer /> Fă lucrare
            </Button>
          )}
        </div>

        {quote.job_id && (
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/lucrari/${quote.job_id}`}>
              <Hammer /> Vezi lucrarea
            </Link>
          </Button>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" asChild>
            <Link href={`/oferte/${quote.id}/editare`}>
              <Pencil /> Editează
            </Link>
          </Button>
          <Confirm
            title="Ștergi oferta?"
            onConfirm={async () => {
              await deleteQuote(quote.id);
              toast.success("Ofertă ștearsă");
              router.replace("/oferte");
            }}
          >
            <Button variant="outline" className="text-red-400 hover:text-red-300">
              <Trash2 /> Șterge
            </Button>
          </Confirm>
        </div>
      </div>
    </div>
  );
}
