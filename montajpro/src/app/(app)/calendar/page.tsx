"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Move } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/jobs/status-badge";
import { useJobs, useTable } from "@/hooks/use-data";
import { updateJob } from "@/lib/db/actions";
import { JOB_TYPE_EMOJI } from "@/lib/constants";
import {
  WEEKDAY_SHORT,
  formatDuration,
  formatMoney,
  monthName,
  parseDateKey,
  toDateKey,
  todayKey,
} from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "month" | "week";

/** Luni = 0, duminică = 6 (calendarul românesc începe lunea). */
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function CalendarPage() {
  const jobs = useJobs();
  const clients = useTable("clients");
  const { currency } = useApp();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string>(todayKey());
  const [moving, setMoving] = useState<Job | null>(null);
  const [newDate, setNewDate] = useState("");

  const byDay = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of jobs) {
      if (!job.scheduled_date) continue;
      (map[job.scheduled_date] ||= []).push(job);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"));
    }
    return map;
  }, [jobs]);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = addDays(first, -mondayIndex(first));
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = addDays(cursor, -mondayIndex(cursor));
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [cursor]);

  const shift = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current);
      if (view === "month") next.setMonth(next.getMonth() + delta);
      else next.setDate(next.getDate() + delta * 7);
      return next;
    });
  };

  const moveJob = async (job: Job, date: string) => {
    await updateJob(job.id, { scheduled_date: date });
    toast.success(`Mutată pe ${date}`);
  };

  const clientName = (job: Job) =>
    clients.find((client) => client.id === job.client_id)?.name ?? "Fără client";

  const selectedJobs = byDay[selected] ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Calendar" description="Programul tău pe zile" />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Înapoi" onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <div className="flex-1 text-center">
          <p className="font-semibold capitalize">
            {view === "month"
              ? `${monthName(cursor.getMonth())} ${cursor.getFullYear()}`
              : `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${monthName(weekDays[6].getMonth())}`}
          </p>
        </div>
        <Button variant="outline" size="icon" aria-label="Înainte" onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Tabs value={view} onValueChange={(value) => setView(value as View)} className="flex-1">
          <TabsList>
            <TabsTrigger value="month" className="flex-1">
              Lună
            </TabsTrigger>
            <TabsTrigger value="week" className="flex-1">
              Săptămână
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          onClick={() => {
            setCursor(new Date());
            setSelected(todayKey());
          }}
        >
          Azi
        </Button>
      </div>

      {view === "month" ? (
        <div className="rounded-2xl border border-border bg-card p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 pb-1">
            {WEEKDAY_SHORT.map((day) => (
              <div key={day} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const key = toDateKey(day);
              const dayJobs = byDay[key] ?? [];
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = key === todayKey();
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const jobId = event.dataTransfer.getData("text/job-id");
                    const job = jobs.find((row) => row.id === jobId);
                    if (job) void moveJob(job, key);
                  }}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg p-1 text-xs transition-colors",
                    inMonth ? "text-foreground" : "text-muted-foreground/40",
                    selected === key
                      ? "bg-primary/15 ring-1 ring-primary"
                      : "hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                      isToday && "bg-primary font-bold text-primary-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {dayJobs.slice(0, 3).map((job) => (
                      <span
                        key={job.id}
                        className={cn(
                          "size-1.5 rounded-full",
                          job.status === "done"
                            ? "bg-emerald-400"
                            : job.status === "issue"
                              ? "bg-red-400"
                              : "bg-cyan-400",
                        )}
                      />
                    ))}
                    {dayJobs.length > 3 && (
                      <span className="text-[9px] leading-none text-muted-foreground">
                        +{dayJobs.length - 3}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {weekDays.map((day) => {
            const key = toDateKey(day);
            const dayJobs = byDay[key] ?? [];
            return (
              <div
                key={key}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const jobId = event.dataTransfer.getData("text/job-id");
                  const job = jobs.find((row) => row.id === jobId);
                  if (job) void moveJob(job, key);
                }}
                className={cn(
                  "rounded-2xl border border-border bg-card p-3",
                  key === todayKey() && "border-primary/40",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold capitalize">
                    {WEEKDAY_SHORT[mondayIndex(day)]}, {day.getDate()} {monthName(day.getMonth())}
                  </p>
                  {key === todayKey() && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                      azi
                    </span>
                  )}
                </div>
                {dayJobs.length ? (
                  <ul className="space-y-1.5">
                    {dayJobs.map((job) => (
                      <li key={job.id}>
                        <JobRow
                          job={job}
                          clientName={clientName(job)}
                          currency={currency}
                          onMove={() => {
                            setMoving(job);
                            setNewDate(job.scheduled_date ?? key);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Liber</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "month" && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4 text-primary" />
            <span className="capitalize">
              {parseDateKey(selected).getDate()} {monthName(parseDateKey(selected).getMonth())}
            </span>
            <span className="text-muted-foreground">· {selectedJobs.length} lucrări</span>
          </h3>
          {selectedJobs.length ? (
            <ul className="space-y-2">
              {selectedJobs.map((job) => (
                <li key={job.id}>
                  <JobRow
                    job={job}
                    clientName={clientName(job)}
                    currency={currency}
                    onMove={() => {
                      setMoving(job);
                      setNewDate(job.scheduled_date ?? selected);
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nicio lucrare în această zi
            </p>
          )}
        </section>
      )}

      <Dialog open={!!moving} onOpenChange={(open) => !open && setMoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mută lucrarea</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{moving?.title}</p>
          <Field label="Data nouă">
            <Input
              type="date"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoving(null)}>
              Anulează
            </Button>
            <Button
              onClick={async () => {
                if (moving && newDate) {
                  await moveJob(moving, newDate);
                  setSelected(newDate);
                }
                setMoving(null);
              }}
            >
              <Move /> Mută
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** O lucrare în calendar: se poate trage pe altă zi (desktop) sau muta din buton. */
function JobRow({
  job,
  clientName,
  currency,
  onMove,
}: {
  job: Job;
  clientName: string;
  currency: string;
  onMove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/job-id", job.id)}
      className="flex items-center gap-2.5 rounded-xl border border-border bg-background p-2.5"
    >
      <span className="font-mono text-xs font-semibold tabular-nums text-primary">
        {job.scheduled_time || "--:--"}
      </span>
      <Link href={`/lucrari/${job.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {JOB_TYPE_EMOJI[job.type]} {job.title}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 truncate text-xs text-muted-foreground">
          <span>{clientName}</span>
          {job.address && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="size-3" />
              {job.address}
            </span>
          )}
          {job.estimated_hours ? (
            <span className="inline-flex items-center gap-0.5">
              <Clock className="size-3" />
              {formatDuration(job.estimated_hours * 60)}
            </span>
          ) : null}
          <span className="font-medium">{formatMoney(job.price_total, currency, { compact: true })}</span>
        </p>
      </Link>
      <StatusBadge status={job.status} className="hidden sm:inline-flex" />
      <Button variant="ghost" size="icon-sm" aria-label="Mută lucrarea" onClick={onMove}>
        <Move />
      </Button>
    </div>
  );
}
