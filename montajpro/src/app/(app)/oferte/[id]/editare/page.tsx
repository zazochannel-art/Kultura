"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteForm } from "@/components/quotes/quote-form";
import { useRow, useStoreReady } from "@/hooks/use-data";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQuoteNumber } from "@/lib/format";

export default function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ready = useStoreReady();
  const quote = useRow("quotes", id);

  if (!ready) return <Skeleton className="h-96 w-full" />;
  if (!quote) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={`Editează oferta ${formatQuoteNumber(quote.number)}`}
        description={quote.title}
      />
      <QuoteForm quote={quote} />
    </div>
  );
}
