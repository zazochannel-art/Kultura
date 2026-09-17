"use client";

/**
 * Acțiunile de scriere ale aplicației.
 *
 * Tot ce modifică date trece pe aici, ca regulile de business (cascade la
 * ștergere, jurnalul de activitate, numerotarea ofertelor) să stea într-un
 * singur loc, nu prin componente.
 */
import { store } from "./store";
import { syncNow } from "./sync";
import type {
  ExpenseCategory,
  Job,
  JobStatus,
  JobType,
  MeasurementData,
  PaymentKind,
  PaymentMethod,
  PhotoStage,
  Quote,
  QuoteItem,
  Settings,
  TableName,
} from "../types";
import { nowISO, num, uid } from "../utils";
import { todayKey } from "../format";

/** Trimite modificările imediat, fără să blocheze interfața. */
function kick() {
  void syncNow();
}

/* ------------------------------- clienți --------------------------- */

export async function saveClient(input: {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}) {
  const payload = {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  const row = input.id
    ? await store.update("clients", input.id, payload)
    : await store.insert("clients", payload);
  kick();
  return row;
}

export async function deleteClient(id: string) {
  // Lucrările rămân, dar pierd legătura — istoricul financiar nu se pierde.
  const jobs = store.getTable("jobs").filter((job) => job.client_id === id);
  for (const job of jobs) await store.update("jobs", job.id, { client_id: null });
  await store.remove("clients", id);
  kick();
}

/* -------------------------------- lucrări -------------------------- */

export interface JobInput {
  id?: string;
  client_id: string | null;
  title: string;
  type: JobType;
  status: JobStatus;
  address?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  estimated_hours?: number | null;
  price_total: number;
  material_cost?: number | null;
  notes?: string | null;
  /** Avansul introdus la creare devine o plată de tip „avans”. */
  advance?: number;
}

export async function saveJob(input: JobInput) {
  const payload = {
    client_id: input.client_id,
    title: input.title.trim(),
    type: input.type,
    status: input.status,
    address: input.address?.trim() || null,
    scheduled_date: input.scheduled_date || null,
    scheduled_time: input.scheduled_time || null,
    estimated_hours: input.estimated_hours ?? null,
    price_total: num(input.price_total),
    material_cost: input.material_cost ?? null,
    notes: input.notes?.trim() || null,
  };

  let job: Job | null;
  if (input.id) {
    job = await store.update("jobs", input.id, payload);
  } else {
    job = await store.insert("jobs", {
      ...payload,
      start_date: null,
      end_date: null,
      in_portfolio: false,
      portfolio_description: null,
    });
    if (job && num(input.advance) > 0) {
      await addPayment({
        job_id: job.id,
        client_id: input.client_id,
        amount: num(input.advance),
        kind: "advance",
        method: "cash",
        paid_at: todayKey(),
        note: "Avans la creare",
      });
    }
  }
  kick();
  return job;
}

export async function setJobStatus(id: string, status: JobStatus) {
  const patch: Partial<Job> = { status };
  if (status === "in_progress") {
    const job = store.getTable("jobs").find((row) => row.id === id);
    if (job && !job.start_date) patch.start_date = todayKey();
  }
  if (status === "done") patch.end_date = todayKey();
  await store.update("jobs", id, patch);
  kick();
}

export async function updateJob(id: string, patch: Partial<Job>) {
  const row = await store.update("jobs", id, patch);
  kick();
  return row;
}

/** Șterge lucrarea și tot ce atârnă de ea. */
export async function deleteJob(id: string) {
  const children: { table: TableName; id: string }[] = [];
  const collect = <K extends TableName>(table: K, match: (row: { job_id?: string | null }) => boolean) => {
    for (const row of store.getTable(table) as unknown as { id: string; job_id?: string | null }[]) {
      if (match(row)) children.push({ table, id: row.id });
    }
  };
  collect("job_measurements", (row) => row.job_id === id);
  collect("job_photos", (row) => row.job_id === id);
  collect("job_materials", (row) => row.job_id === id);
  collect("payments", (row) => row.job_id === id);
  collect("work_sessions", (row) => row.job_id === id);
  collect("notifications", (row) => row.job_id === id);
  // Cheltuielile rămân în evidența financiară, doar pierd legătura.
  for (const expense of store.getTable("expenses").filter((row) => row.job_id === id)) {
    await store.update("expenses", expense.id, { job_id: null });
  }
  for (const quote of store.getTable("quotes").filter((row) => row.job_id === id)) {
    await store.update("quotes", quote.id, { job_id: null });
  }
  await store.removeMany(children);
  await store.remove("jobs", id);
  kick();
}

/* ------------------------------ cronometru ------------------------- */

export async function startWork(jobId: string) {
  const running = store
    .getTable("work_sessions")
    .find((session) => !session.ended_at && !session.deleted_at);
  if (running) await stopWork(running.id);

  const session = await store.insert("work_sessions", {
    job_id: jobId,
    started_at: nowISO(),
    ended_at: null,
    duration_minutes: null,
    note: null,
  });
  const job = store.getTable("jobs").find((row) => row.id === jobId);
  if (job && job.status !== "in_progress") await setJobStatus(jobId, "in_progress");
  kick();
  return session;
}

export async function stopWork(sessionId: string, note?: string) {
  const session = store.getTable("work_sessions").find((row) => row.id === sessionId);
  if (!session || session.ended_at) return null;
  const endedAt = nowISO();
  const minutes = Math.max(
    1,
    Math.round((new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 60_000),
  );
  const row = await store.update("work_sessions", sessionId, {
    ended_at: endedAt,
    duration_minutes: minutes,
    note: note?.trim() || null,
  });
  kick();
  return row;
}

export async function deleteWorkSession(id: string) {
  await store.remove("work_sessions", id);
  kick();
}

/* ------------------------------ măsurători ------------------------- */

export async function saveMeasurement(input: {
  id?: string;
  job_id: string | null;
  client_id?: string | null;
  kind: JobType;
  label?: string | null;
  data: MeasurementData;
  notes?: string | null;
}) {
  const payload = {
    job_id: input.job_id,
    client_id: input.client_id ?? null,
    kind: input.kind,
    label: input.label?.trim() || null,
    data: input.data,
    notes: input.notes?.trim() || null,
  };
  const row = input.id
    ? await store.update("job_measurements", input.id, payload)
    : await store.insert("job_measurements", payload);
  kick();
  return row;
}

export async function deleteMeasurement(id: string) {
  await store.remove("job_measurements", id);
  kick();
}

/* -------------------------------- poze ----------------------------- */

export async function addPhoto(input: {
  job_id: string | null;
  measurement_id?: string | null;
  stage: PhotoStage;
  storage_path: string | null;
  local_key: string | null;
  caption?: string | null;
}) {
  const row = await store.insert("job_photos", {
    job_id: input.job_id,
    measurement_id: input.measurement_id ?? null,
    stage: input.stage,
    storage_path: input.storage_path,
    local_key: input.local_key,
    caption: input.caption ?? null,
  });
  kick();
  return row;
}

export async function deletePhoto(id: string) {
  await store.remove("job_photos", id);
  kick();
}

/* ------------------------- materiale pe lucrare -------------------- */

export async function saveJobMaterial(input: {
  id?: string;
  job_id: string;
  material_id?: string | null;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  purchased?: boolean;
}) {
  const payload = {
    job_id: input.job_id,
    material_id: input.material_id ?? null,
    name: input.name.trim(),
    quantity: num(input.quantity),
    unit: input.unit,
    unit_price: num(input.unit_price),
    purchased: input.purchased ?? false,
  };
  const row = input.id
    ? await store.update("job_materials", input.id, payload)
    : await store.insert("job_materials", payload);
  kick();
  return row;
}

export async function toggleJobMaterial(id: string, purchased: boolean) {
  await store.update("job_materials", id, { purchased });
  kick();
}

export async function deleteJobMaterial(id: string) {
  await store.remove("job_materials", id);
  kick();
}

/* --------------------------- inventar materiale -------------------- */

export async function saveMaterial(input: {
  id?: string;
  name: string;
  category?: string | null;
  quantity: number;
  unit: string;
  price: number;
  supplier?: string | null;
  notes?: string | null;
}) {
  const payload = {
    name: input.name.trim(),
    category: input.category || null,
    quantity: num(input.quantity),
    unit: input.unit,
    price: num(input.price),
    supplier: input.supplier?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  const row = input.id
    ? await store.update("materials", input.id, payload)
    : await store.insert("materials", payload);
  kick();
  return row;
}

export async function deleteMaterial(id: string) {
  await store.remove("materials", id);
  kick();
}

/* --------------------------------- bani ---------------------------- */

export async function addPayment(input: {
  id?: string;
  job_id: string | null;
  client_id: string | null;
  amount: number;
  kind: PaymentKind;
  method: PaymentMethod;
  paid_at: string;
  note?: string | null;
}) {
  const payload = {
    job_id: input.job_id,
    client_id: input.client_id,
    amount: num(input.amount),
    kind: input.kind,
    method: input.method,
    paid_at: input.paid_at,
    note: input.note?.trim() || null,
  };
  const row = input.id
    ? await store.update("payments", input.id, payload)
    : await store.insert("payments", payload);
  kick();
  return row;
}

export async function deletePayment(id: string) {
  await store.remove("payments", id);
  kick();
}

export async function saveExpense(input: {
  id?: string;
  job_id: string | null;
  category: ExpenseCategory;
  amount: number;
  spent_at: string;
  note?: string | null;
  receipt_path?: string | null;
  receipt_local_key?: string | null;
}) {
  const payload = {
    job_id: input.job_id,
    category: input.category,
    amount: num(input.amount),
    spent_at: input.spent_at,
    note: input.note?.trim() || null,
    receipt_path: input.receipt_path ?? null,
    receipt_local_key: input.receipt_local_key ?? null,
  };
  const row = input.id
    ? await store.update("expenses", input.id, payload)
    : await store.insert("expenses", payload);
  kick();
  return row;
}

export async function deleteExpense(id: string) {
  await store.remove("expenses", id);
  kick();
}

/* -------------------------------- scule ---------------------------- */

export async function saveTool(input: {
  id?: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  price?: number | null;
  purchased_at?: string | null;
  warranty_months?: number | null;
  notes?: string | null;
  photo_path?: string | null;
  photo_local_key?: string | null;
}) {
  const payload = {
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    model: input.model?.trim() || null,
    price: input.price ?? null,
    purchased_at: input.purchased_at || null,
    warranty_months: input.warranty_months ?? null,
    notes: input.notes?.trim() || null,
    photo_path: input.photo_path ?? null,
    photo_local_key: input.photo_local_key ?? null,
  };
  const row = input.id
    ? await store.update("tools", input.id, payload)
    : await store.insert("tools", payload);
  kick();
  return row;
}

export async function deleteTool(id: string) {
  await store.remove("tools", id);
  kick();
}

/* -------------------------------- oferte --------------------------- */

export function nextQuoteNumber(): number {
  const numbers = store.getTable("quotes").map((quote) => quote.number || 0);
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

export interface QuoteItemInput {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export async function saveQuote(
  input: {
    id?: string;
    client_id: string | null;
    job_id?: string | null;
    title: string;
    status?: Quote["status"];
    advance?: number;
    discount?: number;
    valid_until?: string | null;
    notes?: string | null;
  },
  items: QuoteItemInput[],
) {
  const payload = {
    client_id: input.client_id,
    job_id: input.job_id ?? null,
    title: input.title.trim() || "Ofertă",
    status: input.status ?? ("draft" as const),
    advance: num(input.advance),
    discount: num(input.discount),
    valid_until: input.valid_until || null,
    notes: input.notes?.trim() || null,
  };

  const quote = input.id
    ? await store.update("quotes", input.id, payload)
    : await store.insert("quotes", {
        ...payload,
        number: nextQuoteNumber(),
        sent_at: null,
        accepted_at: null,
      });
  if (!quote) return null;

  const existing = store
    .getTable("quote_items")
    .filter((item) => item.quote_id === quote.id && !item.deleted_at);
  const keptIds = new Set(items.map((item) => item.id).filter(Boolean) as string[]);

  for (const item of existing) {
    if (!keptIds.has(item.id)) await store.remove("quote_items", item.id);
  }

  let position = 0;
  for (const item of items) {
    const itemPayload = {
      quote_id: quote.id,
      description: item.description.trim(),
      quantity: num(item.quantity),
      unit: item.unit || "buc",
      unit_price: num(item.unit_price),
      position: position++,
    };
    if (item.id && existing.some((row) => row.id === item.id)) {
      await store.update("quote_items", item.id, itemPayload);
    } else {
      await store.insert("quote_items", itemPayload);
    }
  }

  kick();
  return quote;
}

export async function setQuoteStatus(id: string, status: Quote["status"]) {
  const patch: Partial<Quote> = { status };
  if (status === "sent") patch.sent_at = nowISO();
  if (status === "accepted") patch.accepted_at = nowISO();
  await store.update("quotes", id, patch);
  kick();
}

export async function deleteQuote(id: string) {
  const items = store.getTable("quote_items").filter((item) => item.quote_id === id);
  await store.removeMany(items.map((item) => ({ table: "quote_items" as const, id: item.id })));
  await store.remove("quotes", id);
  kick();
}

export function quoteTotal(items: Pick<QuoteItem, "quantity" | "unit_price">[], discount = 0) {
  const subtotal = items.reduce(
    (acc, item) => acc + num(item.quantity) * num(item.unit_price),
    0,
  );
  return { subtotal, total: Math.max(0, subtotal - num(discount)) };
}

/** Transformă o ofertă acceptată în lucrare (cu avansul deja înregistrat). */
export async function convertQuoteToJob(quoteId: string, type: JobType = "other") {
  const quote = store.getTable("quotes").find((row) => row.id === quoteId);
  if (!quote) return null;
  const items = store.getTable("quote_items").filter((item) => item.quote_id === quoteId);
  const { total } = quoteTotal(items, quote.discount);

  const job = await saveJob({
    client_id: quote.client_id,
    title: quote.title,
    type,
    status: "confirmed",
    price_total: total,
    advance: quote.advance,
  });
  if (job) {
    await store.update("quotes", quoteId, { job_id: job.id, status: "accepted", accepted_at: nowISO() });
    for (const item of items) {
      await store.insert("job_materials", {
        job_id: job.id,
        material_id: null,
        name: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: 0,
        purchased: false,
      });
    }
  }
  kick();
  return job;
}

/* ----------------------------- notificări -------------------------- */

export async function markNotificationRead(id: string) {
  await store.update("notifications", id, { read_at: nowISO() });
  kick();
}

export async function dismissNotification(id: string) {
  await store.remove("notifications", id);
  kick();
}

/* ------------------------------- setări ---------------------------- */

export async function updateSettings(patch: Partial<Settings>) {
  const current = store.getTable("settings").find((row) => !row.deleted_at);
  if (!current) return null;
  const row = await store.update("settings", current.id, patch);
  kick();
  return row;
}

/** Export complet al datelor, pentru backup manual. */
export function exportData() {
  const state = store.getState();
  return {
    app: "MontajPro",
    version: 1,
    exported_at: nowISO(),
    data: state,
  };
}

/** Import dintr-un backup — rândurile existente se păstrează, restul se adaugă. */
export async function importData(payload: { data?: Record<string, unknown[]> }) {
  const data = payload?.data;
  if (!data) throw new Error("Fișier de backup invalid");
  let imported = 0;
  for (const [table, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows as Record<string, unknown>[]) {
      if (!row || typeof row !== "object") continue;
      await store.insert(table as TableName, {
        ...row,
        id: (row.id as string) || uid(),
      } as never);
      imported++;
    }
  }
  kick();
  return imported;
}
