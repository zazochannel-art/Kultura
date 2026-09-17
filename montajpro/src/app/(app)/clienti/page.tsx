"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Phone, Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientDialog } from "@/components/forms/client-dialog";
import { useClients, useJobs, useStoreReady } from "@/hooks/use-data";
import { formatMoney } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { initials, telHref } from "@/lib/utils";

export default function ClientsPage() {
  const ready = useStoreReady();
  const clients = useClients();
  const jobs = useJobs();
  const { currency } = useApp();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const stats = useMemo(() => {
    const map: Record<string, { count: number; total: number; active: number }> = {};
    for (const job of jobs) {
      if (!job.client_id) continue;
      const entry = (map[job.client_id] ||= { count: 0, total: 0, active: 0 });
      entry.count += 1;
      entry.total += job.price_total;
      if (["confirmed", "materials", "in_progress"].includes(job.status)) entry.active += 1;
    }
    return map;
  }, [jobs]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(needle) ||
        (client.phone ?? "").includes(needle) ||
        (client.address ?? "").toLowerCase().includes(needle),
    );
  }, [clients, query]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clienți"
        description={`${clients.length} clienți în agendă`}
        action={
          <Button className="hidden sm:inline-flex" onClick={() => setDialogOpen(true)}>
            <Plus /> Client nou
          </Button>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Caută după nume, telefon sau adresă"
          className="pl-10"
        />
      </div>

      {!ready ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length ? (
        <ul className="space-y-2">
          {filtered.map((client) => {
            const stat = stats[client.id];
            const phone = telHref(client.phone);
            return (
              <li key={client.id}>
                <div className="card-hover flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 hover:border-primary/40">
                  <Link href={`/clienti/${client.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-sm font-semibold text-primary">
                      {initials(client.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{client.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {stat
                          ? `${stat.count} lucrări · ${formatMoney(stat.total, currency, { compact: true })}`
                          : "Fără lucrări"}
                        {stat?.active ? ` · ${stat.active} active` : ""}
                      </span>
                    </span>
                  </Link>
                  {phone && (
                    <a
                      href={phone}
                      aria-label={`Sună ${client.name}`}
                      className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-primary transition-colors hover:bg-accent"
                    >
                      <Phone className="size-4" />
                    </a>
                  )}
                  <Link href={`/clienti/${client.id}`} aria-label="Deschide" className="shrink-0">
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Users}
          title={query ? "Niciun client găsit" : "Niciun client încă"}
          description={
            query
              ? "Încearcă altă căutare."
              : "Adaugă clienții ca să vezi rapid istoricul lucrărilor și plățile."
          }
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> Client nou
            </Button>
          }
        />
      )}

      <ClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
