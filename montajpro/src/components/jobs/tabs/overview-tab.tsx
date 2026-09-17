"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  Phone,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from "@/lib/constants";
import { JOB_STATUSES } from "@/lib/types";
import type { Client, Job, JobStatus } from "@/lib/types";
import type { JobMoney } from "@/lib/calc";
import { deleteJob, setJobStatus } from "@/lib/db/actions";
import { formatDate, formatDuration, formatMoney } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { mapsHref, telHref } from "@/lib/utils";

/** Rezumatul lucrării: cine, unde, când, cât. */
export function OverviewTab({
  job,
  client,
  money,
  workedMinutes,
}: {
  job: Job;
  client: Client | null;
  money: JobMoney;
  workedMinutes: number;
}) {
  const { currency } = useApp();
  const router = useRouter();
  const phone = telHref(client?.phone);
  const maps = mapsHref(job.address || client?.address);
  const whatsapp = client?.phone
    ? `https://wa.me/${client.phone.replace(/[^\d]/g, "")}`
    : null;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Client
        </p>
        {client ? (
          <>
            <Link
              href={`/clienti/${client.id}`}
              className="flex items-center gap-3"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
                <User className="size-5 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {client.name}
                </span>
                {client.phone && (
                  <span className="block truncate text-sm text-muted-foreground">
                    {client.phone}
                  </span>
                )}
              </span>
            </Link>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <a
                href={phone ?? "#"}
                onClick={(event) => !phone && event.preventDefault()}
                className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent ${phone ? "" : "pointer-events-none opacity-50"}`}
              >
                <Phone className="size-4" /> Sună
              </a>
              <a
                href={whatsapp ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => !whatsapp && event.preventDefault()}
                className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent ${whatsapp ? "" : "pointer-events-none opacity-50"}`}
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>
              <a
                href={maps ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => !maps && event.preventDefault()}
                className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent ${maps ? "" : "pointer-events-none opacity-50"}`}
              >
                <Navigation className="size-4" /> Hartă
              </a>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Fără client.{" "}
            <Link
              href={`/lucrari/${job.id}/editare`}
              className="text-primary hover:underline"
            >
              Adaugă unul
            </Link>
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Detalii
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Tip lucrare</dt>
            <dd className="font-medium">{JOB_TYPE_LABELS[job.type]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ore lucrate</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <Clock className="size-3.5 text-muted-foreground" />
              {formatDuration(workedMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Programată</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <CalendarDays className="size-3.5 text-muted-foreground" />
              {formatDate(job.scheduled_date)}
              {job.scheduled_time && `, ${job.scheduled_time}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Durată estimată</dt>
            <dd className="font-medium">
              {job.estimated_hours
                ? formatDuration(job.estimated_hours * 60)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Începută</dt>
            <dd className="font-medium">{formatDate(job.start_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Finalizată</dt>
            <dd className="font-medium">{formatDate(job.end_date)}</dd>
          </div>
          {(job.address || client?.address) && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Adresă</dt>
              <dd className="flex items-start gap-1.5 font-medium">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                {job.address || client?.address}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </p>
        <Select
          value={job.status}
          onValueChange={async (value) => {
            await setJobStatus(job.id, value as JobStatus);
            toast.success(`Status: ${JOB_STATUS_LABELS[value as JobStatus]}`);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JOB_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Bani
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-background p-3">
            <p className="text-xs text-muted-foreground">Preț</p>
            <p className="text-base font-bold tabular-nums">
              {formatMoney(money.price, currency, { compact: true })}
            </p>
          </div>
          <div className="rounded-xl bg-background p-3">
            <p className="text-xs text-muted-foreground">Încasat</p>
            <p className="text-base font-bold tabular-nums text-emerald-300">
              {formatMoney(money.paid, currency, { compact: true })}
            </p>
          </div>
          <div className="rounded-xl bg-background p-3">
            <p className="text-xs text-muted-foreground">Rest</p>
            <p className="text-base font-bold tabular-nums text-amber-300">
              {formatMoney(money.rest, currency, { compact: true })}
            </p>
          </div>
        </div>
      </section>

      {job.notes && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notițe
          </p>
          <p className="whitespace-pre-wrap text-sm">{job.notes}</p>
        </section>
      )}

      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/lucrari/${job.id}/editare`}>
            <Pencil /> Editează
          </Link>
        </Button>
        <Confirm
          title="Ștergi lucrarea?"
          description="Se șterg și măsurătorile, pozele, materialele și plățile legate de ea."
          onConfirm={async () => {
            await deleteJob(job.id);
            toast.success("Lucrare ștearsă");
            router.replace("/lucrari");
          }}
        >
          <Button variant="outline" className="text-red-400 hover:text-red-300">
            <Trash2 /> Șterge
          </Button>
        </Confirm>
      </div>
    </div>
  );
}
