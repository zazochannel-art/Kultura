"use client";

import { PageHeader } from "@/components/layout/page-header";
import { QuoteForm } from "@/components/quotes/quote-form";

export default function NewQuotePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Ofertă nouă" description="Adaugă liniile — totalul se calculează singur" />
      <QuoteForm />
    </div>
  );
}
