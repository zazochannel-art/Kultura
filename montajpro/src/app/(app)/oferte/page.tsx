"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreReady, useTable } from "@/hooks/use-data";
import { quoteTotal } from "@/lib/db/actions";
import { QUOTE_STATUS_CLASSES, QUOTE_STATUS_LABELS } from "@/lib/constants";
import { QUOTE_STATUSES } from "@/lib/types";
import type { QuoteStatus } from "@/lib/types";
import { formatDateShort, formatMoney, formatQuoteNumber } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { cn } from "@/lib/utils";

type Filter = QuoteStatus | "all";

export default function QuotesPage() {
  const ready = useStoreReady();
  const quotes = useTable("quotes");
  const items = useTable("quote_items");
  const clients = useTable("clients");
  const { currency } = useApp();
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(
    () =>
      [...quotes]
        .filter((quote) => filter === "all" || quote.status === filter)
        .sort((a, b) => b.number - a.number)
        .map((quote) => ({
          quote,
          total: quoteTotal(
            items.filter((item) => item.quote_id === quote.id),
            quote.discount,
          ).total,
          client: clients.find((client) => client.id === quote.client_id),
        })),
    [quotes, items, clients, filter],
  );

  const counts = useMemo(() => {
    const result = { all: quotes.length } as Record<Filter, number>;
    for (const status of QUOTE_STATUSES) {
      result[status] = quotes.filter((quote) => quote.status === status).length;
    }
    return result;
  }, [quotes]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Oferte"
        description="Trimite prețuri clare, urmărește ce s-a confirmat"
        action={
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/oferte/nou">
              <Plus /> Ofertă nouă
            </Link>
          </Button>
        }
      />

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Toate", count: counts.all },
          ...QUOTE_STATUSES.map((status) => ({
            value: status as Filter,
            label: QUOTE_STATUS_LABELS[status],
            count: counts[status],
          })),
        ]}
      />

      {!ready ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length ? (
        <ul className="space-y-2">
          {rows.map(({ quote, total, client }) => (
            <li key={quote.id}>
              <Link
                href={`/oferte/${quote.id}`}
                className="card-hover flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-300">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatQuoteNumber(quote.number)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        QUOTE_STATUS_CLASSES[quote.status],
                      )}
                    >
                      {QUOTE_STATUS_LABELS[quote.status]}
                    </span>
                  </div>
                  <p className="truncate font-medium">{quote.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {client?.name ?? "Fără client"} · {formatDateShort(quote.created_at)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums">
                    {formatMoney(total, currency, { compact: true })}
                  </p>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={FileText}
          title="Nicio ofertă"
          description="Fă o ofertă profesională în câteva secunde și trimite-o clientului."
          action={
            <Button asChild>
              <Link href="/oferte/nou">
                <Plus /> Ofertă nouă
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
