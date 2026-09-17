"use client";

import { useMemo, useSyncExternalStore } from "react";
import { store } from "@/lib/db/store";
import type { TableName, Tables } from "@/lib/types";
import { jobMoney, totalWorkedMinutes } from "@/lib/calc";
import { todayKey, toDateKey } from "@/lib/format";

/**
 * Selectori peste store. Toate returnează rânduri „vii” (fără cele șterse
 * logic) și memorează rezultatele derivate, ca React să nu re-randeze inutil.
 */

const EMPTY: never[] = [];

/**
 * Un ceas care avansează din minut în minut.
 *
 * Calculele care includ o sesiune de lucru în desfășurare depind de „acum”, iar
 * citirea directă a ceasului în timpul randării ar face componenta impură.
 */
function subscribeMinute(onTick: () => void) {
  const timer = setInterval(onTick, 30_000);
  return () => clearInterval(timer);
}

export function useMinuteTick(): number {
  return useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => 0,
  );
}

export function useTable<K extends TableName>(table: K): Tables[K][] {
  const rows = useSyncExternalStore(
    store.subscribe,
    () => store.getTable(table),
    () => EMPTY as unknown as Tables[K][],
  );
  return useMemo(() => rows.filter((row) => !row.deleted_at), [rows]);
}

export function useRow<K extends TableName>(
  table: K,
  id: string | null | undefined,
): Tables[K] | null {
  const rows = useTable(table);
  return useMemo(
    () => (id ? (rows.find((row) => row.id === id) ?? null) : null),
    [rows, id],
  );
}

export function useStoreReady(): boolean {
  return useSyncExternalStore(
    store.subscribe,
    () => store.ready,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Selectori de domeniu                                                */
/* ------------------------------------------------------------------ */

export function useClients() {
  const clients = useTable("clients");
  return useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, "ro")),
    [clients],
  );
}

/** Lucrările, cele mai recente / apropiate primele. */
export function useJobs() {
  const jobs = useTable("jobs");
  return useMemo(
    () =>
      [...jobs].sort((a, b) => {
        const aKey = a.scheduled_date || a.created_at.slice(0, 10);
        const bKey = b.scheduled_date || b.created_at.slice(0, 10);
        if (aKey === bKey) return b.created_at.localeCompare(a.created_at);
        return bKey.localeCompare(aKey);
      }),
    [jobs],
  );
}

export function useClientName(clientId: string | null | undefined): string {
  const clients = useTable("clients");
  return useMemo(() => {
    if (!clientId) return "Fără client";
    return clients.find((client) => client.id === clientId)?.name ?? "Client șters";
  }, [clients, clientId]);
}

/** Toate datele legate de o lucrare, plus calculele financiare. */
export function useJobDetails(jobId: string | null | undefined) {
  const now = useMinuteTick();
  const job = useRow("jobs", jobId);
  const client = useRow("clients", job?.client_id);
  const allMeasurements = useTable("job_measurements");
  const allPhotos = useTable("job_photos");
  const allMaterials = useTable("job_materials");
  const allPayments = useTable("payments");
  const allExpenses = useTable("expenses");
  const allSessions = useTable("work_sessions");
  const allQuotes = useTable("quotes");

  return useMemo(() => {
    const measurements = allMeasurements.filter((row) => row.job_id === jobId);
    const photos = allPhotos.filter((row) => row.job_id === jobId);
    const materials = allMaterials.filter((row) => row.job_id === jobId);
    const payments = allPayments
      .filter((row) => row.job_id === jobId)
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
    const expenses = allExpenses.filter((row) => row.job_id === jobId);
    const sessions = allSessions
      .filter((row) => row.job_id === jobId)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    const quotes = allQuotes.filter((row) => row.job_id === jobId);
    const activeSession = sessions.find((row) => !row.ended_at) ?? null;

    const money = jobMoney({
      price: job?.price_total ?? 0,
      payments,
      materials,
      expenses,
      extraMaterialCost: job?.material_cost ?? 0,
    });

    return {
      job,
      client,
      measurements,
      photos,
      materials,
      payments,
      expenses,
      sessions,
      quotes,
      activeSession,
      money,
      workedMinutes: totalWorkedMinutes(sessions, now),
    };
  }, [
    now,
    job,
    client,
    jobId,
    allMeasurements,
    allPhotos,
    allMaterials,
    allPayments,
    allExpenses,
    allSessions,
    allQuotes,
  ]);
}

export interface JobSummary {
  id: string;
  paid: number;
  advance: number;
  rest: number;
}

/** Sumele încasate per lucrare — folosit în liste. */
export function useJobPaymentIndex(): Record<string, JobSummary> {
  const payments = useTable("payments");
  const jobs = useTable("jobs");
  return useMemo(() => {
    const index: Record<string, JobSummary> = {};
    for (const job of jobs) {
      index[job.id] = { id: job.id, paid: 0, advance: 0, rest: job.price_total };
    }
    for (const payment of payments) {
      if (!payment.job_id) continue;
      const entry = (index[payment.job_id] ||= {
        id: payment.job_id,
        paid: 0,
        advance: 0,
        rest: 0,
      });
      entry.paid += payment.amount;
      if (payment.kind === "advance") entry.advance += payment.amount;
    }
    for (const job of jobs) {
      const entry = index[job.id];
      if (entry) entry.rest = job.price_total - entry.paid;
    }
    return index;
  }, [payments, jobs]);
}

/** Sesiunea de lucru activă, oriunde ar fi ea. */
export function useActiveSession() {
  const sessions = useTable("work_sessions");
  return useMemo(() => sessions.find((row) => !row.ended_at) ?? null, [sessions]);
}

export function useDashboardData() {
  const now = useMinuteTick();
  const jobs = useJobs();
  const payments = useTable("payments");
  const expenses = useTable("expenses");
  const materials = useTable("job_materials");
  const sessions = useTable("work_sessions");
  const quotes = useTable("quotes");
  const paymentIndex = useJobPaymentIndex();

  return useMemo(() => {
    const today = todayKey();
    const monthPrefix = today.slice(0, 7);

    const activeJobs = jobs.filter((job) =>
      ["confirmed", "materials", "in_progress"].includes(job.status),
    );
    const todayJobs = jobs
      .filter((job) => job.scheduled_date === today && job.status !== "done")
      .sort((a, b) => (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"));

    const receivable = jobs
      .filter((job) => job.status !== "quote")
      .reduce((acc, job) => acc + Math.max(0, paymentIndex[job.id]?.rest ?? 0), 0);

    const monthIncome = payments
      .filter((payment) => payment.paid_at.slice(0, 7) === monthPrefix)
      .reduce((acc, payment) => acc + payment.amount, 0);

    const monthExpenses = expenses
      .filter((expense) => expense.spent_at.slice(0, 7) === monthPrefix)
      .reduce((acc, expense) => acc + expense.amount, 0);

    const monthMinutes = sessions
      .filter((session) => toDateKey(session.started_at).slice(0, 7) === monthPrefix)
      .reduce(
        (acc, session) =>
          acc +
          (session.ended_at
            ? (session.duration_minutes ?? 0)
            : Math.max(0, Math.round((now - new Date(session.started_at).getTime()) / 60000))),
        0,
      );

    const activeJobIds = new Set(activeJobs.map((job) => job.id));
    const neededMaterials = materials.filter(
      (material) => !material.purchased && activeJobIds.has(material.job_id),
    );

    const pendingQuotes = quotes.filter((quote) => quote.status === "sent");

    return {
      activeJobs,
      todayJobs,
      recentJobs: [...jobs]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 5),
      receivable,
      monthIncome,
      monthExpenses,
      monthProfit: monthIncome - monthExpenses,
      monthMinutes,
      neededMaterials,
      pendingQuotes,
    };
  }, [jobs, payments, expenses, materials, sessions, quotes, paymentIndex, now]);
}
