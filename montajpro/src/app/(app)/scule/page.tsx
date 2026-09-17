"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, ShieldCheck, ShieldAlert, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { AssetImage } from "@/components/photo/asset-image";
import { ToolDialog } from "@/components/forms/tool-dialog";
import { useTable } from "@/hooks/use-data";
import { deleteTool } from "@/lib/db/actions";
import { daysUntil, warrantyEndDate } from "@/lib/calc";
import { formatDateShort, formatMoney, toDateKey } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import type { Tool } from "@/lib/types";
import { sum } from "@/lib/utils";

/** Evidența sculelor, cu alerte de garanție. */
export default function ToolsPage() {
  const { currency } = useApp();
  const tools = useTable("tools");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tool | null>(null);

  const rows = useMemo(
    () =>
      [...tools]
        .map((tool) => {
          const end = warrantyEndDate(tool.purchased_at, tool.warranty_months);
          const days = end ? daysUntil(end) : null;
          return { tool, end, days };
        })
        .sort((a, b) => a.tool.name.localeCompare(b.tool.name, "ro")),
    [tools],
  );

  const expiring = rows.filter(({ days }) => days !== null && days >= 0 && days <= 30);
  const totalValue = sum(tools, (tool) => tool.price ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scule"
        description={`${tools.length} scule · ${formatMoney(totalValue, currency)}`}
        action={
          <Button
            className="hidden sm:inline-flex"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus /> Sculă nouă
          </Button>
        }
      />

      {expiring.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-200">
            <ShieldAlert className="size-4" /> {expiring.length} garanții expiră în curând
          </p>
          <ul className="mt-1.5 space-y-0.5 text-xs text-amber-200/80">
            {expiring.map(({ tool, days }) => (
              <li key={tool.id}>
                {tool.name} — în {days} zile
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ tool, end, days }) => (
            <li
              key={tool.id}
              className="flex gap-3 rounded-2xl border border-border bg-card p-3.5"
            >
              <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                {tool.photo_path || tool.photo_local_key ? (
                  <AssetImage
                    storagePath={tool.photo_path}
                    localKey={tool.photo_local_key}
                    alt={tool.name}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Wrench className="size-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{tool.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[tool.brand, tool.model].filter(Boolean).join(" ") || "Fără detalii"}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {tool.price ? (
                    <span className="text-xs font-medium tabular-nums">
                      {formatMoney(tool.price, currency)}
                    </span>
                  ) : null}
                  {end && days !== null && (
                    <Badge variant={days < 0 ? "outline" : days <= 30 ? "warning" : "success"}>
                      {days < 0 ? (
                        <>Garanție expirată</>
                      ) : (
                        <>
                          <ShieldCheck className="size-3" /> {formatDateShort(toDateKey(end))}
                        </>
                      )}
                    </Badge>
                  )}
                </div>
                {tool.notes && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{tool.notes}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editează"
                  onClick={() => {
                    setEditing(tool);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <Confirm
                  title="Ștergi scula?"
                  onConfirm={async () => {
                    await deleteTool(tool.id);
                    toast.success("Sculă ștearsă");
                  }}
                >
                  <Button variant="ghost" size="icon-sm" aria-label="Șterge">
                    <Trash2 className="text-red-400" />
                  </Button>
                </Confirm>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Wrench}
          title="Nicio sculă în evidență"
          description="Adaugă sculele cu data cumpărării și garanția — te anunțăm înainte să expire."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus /> Sculă nouă
            </Button>
          }
        />
      )}

      <Button
        variant="outline"
        className="w-full sm:hidden"
        size="lg"
        onClick={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
      >
        <Plus /> Sculă nouă
      </Button>

      <ToolDialog open={dialogOpen} onOpenChange={setDialogOpen} tool={editing} />
    </div>
  );
}
