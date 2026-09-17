/**
 * Motorul de sincronizare între IndexedDB și Supabase.
 *
 * Push: fiecare rând marcat în outbox se trimite cu `upsert` (ștergerile sunt
 * logice, deci tot upsert). Pull: pentru fiecare tabel cerem rândurile cu
 * `updated_at` mai nou decât cursorul salvat local.
 *
 * Conflictele se rezolvă „last write wins” pe `updated_at`, iar rândurile încă
 * nesincronizate au prioritate (vezi `store.applyRemote`).
 */
import { getSupabase } from "../supabase/client";
import { metaGet, metaSet } from "./idb";
import { store } from "./store";
import { toPayload } from "./columns";
import { TABLE_NAMES } from "../types";
import type { BaseRow, TableName } from "../types";

const PAGE_SIZE = 500;
const EPOCH = "1970-01-01T00:00:00.000Z";

let inFlight: Promise<void> | null = null;

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

async function pushOutbox(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const entries = store.getOutbox();
  if (!entries.length) return;

  // Grupăm pe tabel ca să trimitem un singur upsert per tabel.
  const byTable = new Map<TableName, { rows: BaseRow[]; keys: string[] }>();
  for (const entry of entries) {
    const row = (store.getTable(entry.table) as BaseRow[]).find(
      (r) => r.id === entry.id,
    );
    if (!row) {
      // Rândul nu mai există local — intrarea este inutilă.
      await store.clearOutboxEntries([entry.key]);
      continue;
    }
    const bucket = byTable.get(entry.table) ?? { rows: [], keys: [] };
    bucket.rows.push(row);
    bucket.keys.push(entry.key);
    byTable.set(entry.table, bucket);
  }

  // Ordinea din TABLE_NAMES este și ordinea dependențelor (clienți înainte de
  // lucrări, lucrări înainte de materiale) — altfel cheile străine ar pica.
  for (const table of TABLE_NAMES) {
    const bucket = byTable.get(table);
    if (!bucket) continue;
    const payload = bucket.rows.map((row) =>
      toPayload(table, row as unknown as Record<string, unknown>),
    );
    const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
    await store.clearOutboxEntries(bucket.keys);
  }
}

async function pullTable(table: TableName): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const cursor = (await metaGet<string>(`cursor:${table}`)) || EPOCH;
  let from = 0;
  let newest = cursor;

  for (;;) {
    // Cursorul merge pe `synced_at` (ceasul serverului), nu pe `updated_at`
    // (ceasul telefonului) — altfel un dispozitiv cu ora greșită ar putea
    // scrie rânduri pe care celelalte nu le-ar mai vedea niciodată.
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .gt("synced_at", cursor)
      .order("synced_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as (BaseRow & { synced_at?: string })[];
    if (!rows.length) break;

    // @ts-expect-error — rândurile vin tipate din schema Supabase.
    await store.applyRemote(table, rows);
    newest = rows[rows.length - 1].synced_at ?? newest;

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (newest !== cursor) await metaSet(`cursor:${table}`, newest);
}

/** Rulează o sincronizare completă. Apelurile paralele se unesc. */
export function syncNow(): Promise<void> {
  if (inFlight) return inFlight;

  const supabase = getSupabase();
  if (!supabase) {
    store.setSyncStatus("local");
    return Promise.resolve();
  }
  if (!isOnline()) {
    store.setSyncStatus("offline");
    return Promise.resolve();
  }

  inFlight = (async () => {
    store.setSyncStatus("syncing");
    try {
      await pushOutbox();
      for (const table of TABLE_NAMES) await pullTable(table);
      store.setSyncStatus("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Eroare de sincronizare";
      store.setSyncStatus(isOnline() ? "error" : "offline", message);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
