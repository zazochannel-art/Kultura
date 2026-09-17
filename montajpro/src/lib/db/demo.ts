"use client";

/**
 * Date demonstrative.
 *
 * Sunt marcate explicit cu „(DEMO)” în nume și pot fi șterse dintr-o singură
 * apăsare. Nimic nu se încarcă automat: utilizatorul cere asta din Setări, ca
 * datele reale să nu se amestece niciodată cu cele de probă.
 */
import { store } from "./store";
import { syncNow } from "./sync";
import { todayKey, toDateKey } from "../format";

export const DEMO_TAG = "(DEMO)";

function dayFromNow(days: number): string {
  return toDateKey(new Date(Date.now() + days * 86_400_000));
}

export function hasDemoData(): boolean {
  return store
    .getTable("clients")
    .some((client) => !client.deleted_at && client.name.includes(DEMO_TAG));
}

export async function seedDemoData() {
  const client = await store.insert("clients", {
    name: `Ion Popescu ${DEMO_TAG}`,
    phone: "+37369000000",
    email: null,
    address: "str. Ismail 45, Chișinău",
    notes: "Client de probă — poate fi șters din Setări.",
  });

  const secondClient = await store.insert("clients", {
    name: `Maria Rusu ${DEMO_TAG}`,
    phone: "+37379000000",
    email: null,
    address: "bd. Dacia 12, Chișinău",
    notes: null,
  });

  const stairs = await store.insert("jobs", {
    client_id: client.id,
    title: `Montaj scară stejar ${DEMO_TAG}`,
    type: "stairs",
    status: "in_progress",
    address: "str. Ismail 45, Chișinău",
    scheduled_date: todayKey(),
    scheduled_time: "09:00",
    estimated_hours: 8,
    price_total: 12000,
    material_cost: null,
    start_date: todayKey(),
    end_date: null,
    notes: "Trepte gata finisate, montaj pe structură metalică.",
    in_portfolio: false,
    portfolio_description: null,
  });

  const parquet = await store.insert("jobs", {
    client_id: secondClient.id,
    title: `Montaj parchet apartament ${DEMO_TAG}`,
    type: "parquet",
    status: "confirmed",
    address: "bd. Dacia 12, Chișinău",
    scheduled_date: dayFromNow(2),
    scheduled_time: "10:30",
    estimated_hours: 12,
    price_total: 10200,
    material_cost: null,
    start_date: null,
    end_date: null,
    notes: null,
    in_portfolio: false,
    portfolio_description: null,
  });

  const plinth = await store.insert("jobs", {
    client_id: client.id,
    title: `Plintă MDF living ${DEMO_TAG}`,
    type: "plinth",
    status: "done",
    address: "str. Ismail 45, Chișinău",
    scheduled_date: dayFromNow(-9),
    scheduled_time: "14:00",
    estimated_hours: 4,
    price_total: 3375,
    material_cost: null,
    start_date: dayFromNow(-9),
    end_date: dayFromNow(-9),
    notes: null,
    in_portfolio: true,
    portfolio_description: "75 m de plintă MDF vopsită, colțuri tăiate la 45°.",
  });

  await store.insert("job_measurements", {
    job_id: stairs.id,
    client_id: client.id,
    kind: "stairs",
    label: "Scara principală",
    data: { steps: 15, width: 100, depth: 30, height: 18, thickness: 4, landings: 1 },
    notes: "Perete drept, fără rază.",
  });

  await store.insert("job_measurements", {
    job_id: parquet.id,
    client_id: secondClient.id,
    kind: "parquet",
    label: "Living + dormitoare",
    data: { area: 85, waste_percent: 10, parquet_type: "Stejar 14 mm", rooms: 3 },
    notes: null,
  });

  await store.insert("job_materials", {
    job_id: stairs.id,
    material_id: null,
    name: "Lac poliuretanic",
    quantity: 3,
    unit: "l",
    unit_price: 450,
    purchased: true,
  });

  await store.insert("job_materials", {
    job_id: parquet.id,
    material_id: null,
    name: "Adeziv parchet",
    quantity: 4,
    unit: "kg",
    unit_price: 320,
    purchased: false,
  });

  await store.insert("payments", {
    job_id: stairs.id,
    client_id: client.id,
    amount: 5000,
    kind: "advance",
    method: "cash",
    paid_at: dayFromNow(-3),
    note: "Avans la confirmare",
  });

  await store.insert("payments", {
    job_id: plinth.id,
    client_id: client.id,
    amount: 3375,
    kind: "final",
    method: "transfer",
    paid_at: dayFromNow(-9),
    note: null,
  });

  await store.insert("expenses", {
    job_id: stairs.id,
    category: "materials",
    amount: 1350,
    spent_at: dayFromNow(-4),
    note: `Lac + accesorii ${DEMO_TAG}`,
    receipt_path: null,
    receipt_local_key: null,
  });

  await store.insert("expenses", {
    job_id: null,
    category: "fuel",
    amount: 600,
    spent_at: dayFromNow(-1),
    note: `Motorină ${DEMO_TAG}`,
    receipt_path: null,
    receipt_local_key: null,
  });

  await store.insert("materials", {
    name: `Parchet stejar 14 mm ${DEMO_TAG}`,
    category: "Parchet",
    quantity: 24,
    unit: "m²",
    price: 620,
    supplier: "Depozit local",
    notes: null,
  });

  await store.insert("tools", {
    name: `Ferăstrău circular ${DEMO_TAG}`,
    brand: "Makita",
    model: "HS7601",
    price: 3200,
    purchased_at: dayFromNow(-700),
    warranty_months: 24,
    notes: "În mașină.",
    photo_path: null,
    photo_local_key: null,
  });

  const quote = await store.insert("quotes", {
    number: 1,
    client_id: secondClient.id,
    job_id: parquet.id,
    status: "sent",
    title: `Montaj parchet apartament ${DEMO_TAG}`,
    advance: 4000,
    discount: 0,
    valid_until: dayFromNow(14),
    notes: "Preț valabil pentru suprafața măsurată la fața locului.",
    sent_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    accepted_at: null,
  });

  await store.insert("quote_items", {
    quote_id: quote.id,
    description: "Montaj parchet",
    quantity: 85,
    unit: "m²",
    unit_price: 120,
    position: 0,
  });

  await store.insert("work_sessions", {
    job_id: stairs.id,
    started_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    ended_at: new Date(Date.now() - 3 * 86_400_000 + 7.5 * 3_600_000).toISOString(),
    duration_minutes: 450,
    note: null,
  });

  void syncNow();
}

/** Șterge tot ce poartă marcajul „(DEMO)”, împreună cu rândurile atârnate. */
export async function removeDemoData() {
  const demoJobs = store
    .getTable("jobs")
    .filter((job) => !job.deleted_at && job.title.includes(DEMO_TAG));
  const jobIds = new Set(demoJobs.map((job) => job.id));

  const demoQuotes = store
    .getTable("quotes")
    .filter((quote) => !quote.deleted_at && quote.title.includes(DEMO_TAG));

  for (const quote of demoQuotes) {
    for (const item of store.getTable("quote_items").filter((i) => i.quote_id === quote.id)) {
      await store.remove("quote_items", item.id);
    }
    await store.remove("quotes", quote.id);
  }

  for (const table of [
    "job_measurements",
    "job_photos",
    "job_materials",
    "payments",
    "work_sessions",
    "notifications",
  ] as const) {
    for (const row of store.getTable(table)) {
      const jobId = (row as { job_id?: string | null }).job_id;
      if (jobId && jobIds.has(jobId)) await store.remove(table, row.id);
    }
  }

  for (const expense of store.getTable("expenses")) {
    const isDemo =
      (expense.job_id && jobIds.has(expense.job_id)) || expense.note?.includes(DEMO_TAG);
    if (isDemo) await store.remove("expenses", expense.id);
  }

  for (const job of demoJobs) await store.remove("jobs", job.id);

  for (const client of store.getTable("clients")) {
    if (client.name.includes(DEMO_TAG)) await store.remove("clients", client.id);
  }
  for (const material of store.getTable("materials")) {
    if (material.name.includes(DEMO_TAG)) await store.remove("materials", material.id);
  }
  for (const tool of store.getTable("tools")) {
    if (tool.name.includes(DEMO_TAG)) await store.remove("tools", tool.id);
  }

  void syncNow();
}
