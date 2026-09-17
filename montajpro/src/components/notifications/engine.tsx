"use client";

import { useEffect, useRef } from "react";
import { store } from "@/lib/db/store";
import { useApp } from "@/lib/app-provider";
import { useTable } from "@/hooks/use-data";
import { daysUntil, warrantyEndDate } from "@/lib/calc";
import { formatDateShort, todayKey, toDateKey } from "@/lib/format";
import type { NotificationKind } from "@/lib/types";

/**
 * Generatorul de notificări.
 *
 * Nu există server care să trimită push-uri, așa că regulile rulează local, la
 * fiecare deschidere a aplicației. Fiecare notificare are o cheie stabilă
 * (`kind:job:dată`) ca să nu apară de două ori.
 */

interface Candidate {
  key: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  job_id: string | null;
  due_date: string | null;
}

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function NotificationEngine() {
  const { settings, ready } = useApp();
  const jobs = useTable("jobs");
  const payments = useTable("payments");
  const materials = useTable("job_materials");
  const tools = useTable("tools");
  const quotes = useTable("quotes");
  const clients = useTable("clients");
  const existing = useTable("notifications");
  // Fiecare inserare re-declanșează efectul; fără acest zăvor două rulări
  // paralele ar putea scrie aceeași notificare de două ori.
  const busy = useRef(false);

  useEffect(() => {
    if (!ready || !settings) return;

    const run = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const prefs = settings.notification_prefs;
        const today = todayKey();
        const tomorrow = toDateKey(new Date(Date.now() + 86_400_000));
        const candidates: Candidate[] = [];
        const clientName = (id: string | null) =>
          clients.find((client) => client.id === id)?.name ??
          "client necunoscut";

        if (prefs.job_today) {
          for (const job of jobs) {
            if (job.scheduled_date === today && job.status !== "done") {
              candidates.push({
                key: `job_today:${job.id}:${today}`,
                kind: "job_today",
                title: "Lucrare astăzi",
                body: `${job.title} — ${clientName(job.client_id)}${job.scheduled_time ? `, ora ${job.scheduled_time}` : ""}`,
                job_id: job.id,
                due_date: today,
              });
            }
          }
        }

        if (prefs.job_tomorrow) {
          for (const job of jobs) {
            if (job.scheduled_date === tomorrow && job.status !== "done") {
              candidates.push({
                key: `job_tomorrow:${job.id}:${tomorrow}`,
                kind: "job_tomorrow",
                title: "Lucrare mâine",
                body: `${job.title} — ${clientName(job.client_id)}`,
                job_id: job.id,
                due_date: tomorrow,
              });
            }
          }
        }

        if (prefs.payment_due) {
          for (const job of jobs.filter((row) => row.status === "done")) {
            const paid = payments
              .filter((payment) => payment.job_id === job.id)
              .reduce((acc, payment) => acc + payment.amount, 0);
            const rest = job.price_total - paid;
            if (rest > 0.5) {
              candidates.push({
                key: `payment_due:${job.id}`,
                kind: "payment_due",
                title: "Plată restantă",
                body: `${job.title} — mai sunt de încasat ${Math.round(rest)}`,
                job_id: job.id,
                due_date: job.end_date,
              });
            }
          }
        }

        if (prefs.materials_missing) {
          for (const job of jobs) {
            if (!["confirmed", "materials", "in_progress"].includes(job.status))
              continue;
            const days = job.scheduled_date
              ? daysUntil(job.scheduled_date)
              : null;
            if (days !== null && days > 3) continue;
            const missing = materials.filter(
              (material) => material.job_id === job.id && !material.purchased,
            );
            if (missing.length) {
              candidates.push({
                key: `materials_missing:${job.id}:${missing.length}`,
                kind: "materials_missing",
                title: "Materiale lipsă",
                body: `${job.title} — ${missing.length} materiale necumpărate`,
                job_id: job.id,
                due_date: job.scheduled_date,
              });
            }
          }
        }

        if (prefs.tool_warranty) {
          for (const tool of tools) {
            const end = warrantyEndDate(
              tool.purchased_at,
              tool.warranty_months,
            );
            if (!end) continue;
            const days = daysUntil(end);
            if (days === null || days < 0 || days > 30) continue;
            candidates.push({
              key: `tool_warranty:${tool.id}`,
              kind: "tool_warranty",
              title: "Garanție care expiră",
              body: `${tool.name} — garanția expiră pe ${formatDateShort(toDateKey(end))}`,
              job_id: null,
              due_date: toDateKey(end),
            });
          }
        }

        if (prefs.quote_pending) {
          for (const quote of quotes) {
            if (quote.status !== "sent" || !quote.sent_at) continue;
            const days = daysUntil(quote.sent_at);
            if (days === null || days > -3) continue;
            candidates.push({
              key: `quote_pending:${quote.id}`,
              kind: "quote_pending",
              title: "Ofertă neconfirmată",
              body: `${quote.title} — trimisă acum ${Math.abs(days)} zile`,
              job_id: quote.job_id,
              due_date: null,
            });
          }
        }

        // Cheia stă în `body` prin combinația kind+job+due_date; comparăm direct.
        const known = new Set(
          existing.map(
            (row) =>
              `${row.kind}:${row.job_id ?? ""}:${row.due_date ?? ""}:${row.body ?? ""}`,
          ),
        );

        for (const candidate of candidates) {
          const signature = `${candidate.kind}:${candidate.job_id ?? ""}:${candidate.due_date ?? ""}:${candidate.body ?? ""}`;
          if (known.has(signature)) continue;
          known.add(signature);
          await store.insert("notifications", {
            kind: candidate.kind,
            title: candidate.title,
            body: candidate.body,
            job_id: candidate.job_id,
            due_date: candidate.due_date,
            read_at: null,
          });
        }
      } finally {
        busy.current = false;
      }
    };

    void run();
    const timer = window.setInterval(() => void run(), CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [
    ready,
    settings,
    jobs,
    payments,
    materials,
    tools,
    quotes,
    clients,
    existing,
  ]);

  return null;
}
