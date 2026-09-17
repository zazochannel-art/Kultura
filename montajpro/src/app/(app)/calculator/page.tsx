"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, FileText, Hammer, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJobs } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { calcTotal, lineTotal, type CalcLine } from "@/lib/calc";
import { formatMoney, formatNumber } from "@/lib/format";
import { JOB_TYPE_LABELS } from "@/lib/constants";
import type { JobType } from "@/lib/types";
import { updateJob } from "@/lib/db/actions";
import { saveCalcDraft } from "@/lib/calc-draft";
import { uid } from "@/lib/utils";

type Preset = Omit<CalcLine, "id">;

function presetsFor(kind: JobType, rates: Record<string, number>): Preset[] {
  if (kind === "stairs") {
    return [
      { description: "Montaj trepte", quantity: 15, unit: "buc", unit_price: rates.stair_step },
      { description: "Contratrepte", quantity: 0, unit: "buc", unit_price: rates.stair_riser },
      { description: "Podest", quantity: 1, unit: "buc", unit_price: rates.landing },
      { description: "Balustradă", quantity: 1, unit: "set", unit_price: rates.railing },
    ];
  }
  if (kind === "parquet") {
    return [
      { description: "Montaj parchet", quantity: 85, unit: "m²", unit_price: rates.parquet_m2 },
    ];
  }
  if (kind === "plinth") {
    return [{ description: "Montaj plintă", quantity: 75, unit: "m", unit_price: rates.plinth_m }];
  }
  return [{ description: "Serviciu", quantity: 1, unit: "buc", unit_price: 0 }];
}

export default function CalculatorPage() {
  const router = useRouter();
  const { currency, settings } = useApp();
  const jobs = useJobs();
  const rates = (settings?.default_rates ?? {}) as unknown as Record<string, number>;

  const [kind, setKind] = useState<JobType>("stairs");
  const [lines, setLines] = useState<CalcLine[]>(() =>
    presetsFor("stairs", rates).map((preset) => ({ ...preset, id: uid() })),
  );
  const [saveOpen, setSaveOpen] = useState(false);
  const [targetJob, setTargetJob] = useState<string>("new");

  const total = useMemo(() => calcTotal(lines), [lines]);

  const switchKind = (next: JobType) => {
    setKind(next);
    setLines(presetsFor(next, rates).map((preset) => ({ ...preset, id: uid() })));
  };

  const update = (id: string, patch: Partial<CalcLine>) =>
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );

  const addLine = () =>
    setLines((current) => [
      ...current,
      { id: uid(), description: "", quantity: 1, unit: "buc", unit_price: 0 },
    ]);

  const removeLine = (id: string) =>
    setLines((current) => current.filter((line) => line.id !== id));

  const usableLines = lines.filter((line) => line.description.trim() && lineTotal(line) > 0);

  const saveToJob = async () => {
    if (!usableLines.length) {
      toast.error("Adaugă cel puțin o linie cu preț");
      return;
    }
    if (targetJob === "new") {
      saveCalcDraft({ kind, lines: usableLines, total });
      router.push("/lucrari/nou");
      return;
    }
    await updateJob(targetJob, { price_total: total });
    toast.success("Prețul a fost salvat în lucrare");
    setSaveOpen(false);
    router.push(`/lucrari/${targetJob}`);
  };

  const toQuote = () => {
    if (!usableLines.length) {
      toast.error("Adaugă cel puțin o linie cu preț");
      return;
    }
    saveCalcDraft({ kind, lines: usableLines, total });
    router.push("/oferte/nou");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Calculator preț"
        description="Pune cantitățile, prețurile ies singure"
      />

      <Tabs value={kind} onValueChange={(value) => switchKind(value as JobType)}>
        <TabsList>
          <TabsTrigger value="stairs">Scări</TabsTrigger>
          <TabsTrigger value="parquet">Parchet</TabsTrigger>
          <TabsTrigger value="plinth">Plintă</TabsTrigger>
          <TabsTrigger value="other">Altceva</TabsTrigger>
        </TabsList>

        <TabsContent value={kind}>
          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="rounded-2xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-2">
                  <Input
                    value={line.description}
                    onChange={(event) => update(line.id, { description: event.target.value })}
                    placeholder="Denumire serviciu"
                    className="h-10 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Șterge linia"
                    onClick={() => removeLine(line.id)}
                  >
                    <X className="text-muted-foreground" />
                  </Button>
                </div>

                <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <Field label="Cantitate">
                    <NumberInput
                      value={line.quantity}
                      onChange={(value) => update(line.id, { quantity: value })}
                      stepper={false}
                      suffix={line.unit}
                    />
                  </Field>
                  <span className="pb-3 text-muted-foreground">×</span>
                  <Field label="Preț unitar">
                    <NumberInput
                      value={line.unit_price}
                      onChange={(value) => update(line.id, { unit_price: value })}
                      stepper={false}
                      suffix={currency}
                    />
                  </Field>
                </div>

                <p className="mt-2.5 text-right text-sm">
                  <span className="text-muted-foreground">
                    {formatNumber(line.quantity)} {line.unit} × {formatMoney(line.unit_price, currency)} ={" "}
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(lineTotal(line), currency)}
                  </span>
                </p>
              </div>
            ))}

            <Button variant="outline" className="w-full" size="lg" onClick={addLine}>
              <Plus /> Adaugă serviciu
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-[calc(var(--bottom-nav-h)+0.75rem)] z-10 space-y-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-2xl lg:static">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calculator className="size-4" /> TOTAL {JOB_TYPE_LABELS[kind].toUpperCase()}
          </span>
          <span className="text-2xl font-bold tabular-nums text-primary">
            {formatMoney(total, currency)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={toQuote}>
            <FileText /> Fă ofertă
          </Button>
          <Button size="lg" onClick={() => setSaveOpen(true)}>
            <Save /> Salvează
          </Button>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unde salvezi calculul?</DialogTitle>
          </DialogHeader>
          <Field label="Lucrare">
            <Select value={targetJob} onValueChange={setTargetJob}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Lucrare nouă</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <p className="text-sm text-muted-foreground">
            Prețul total <strong>{formatMoney(total, currency)}</strong> va fi pus pe lucrare.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Anulează
            </Button>
            <Button onClick={saveToJob}>
              <Hammer /> Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
