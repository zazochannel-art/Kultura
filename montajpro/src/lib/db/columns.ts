import type { TableName } from "../types";

/**
 * Coloanele trimise spre Supabase, tabel cu tabel.
 *
 * PostgREST refuză un `upsert` în lot dacă rândurile nu au exact aceleași
 * chei, iar rândurile locale pot diferi (unele vin din backup, altele au
 * câmpuri opționale lipsă). Normalizăm totul după lista de mai jos — care
 * este și filtrul pentru coloanele puse de server (`synced_at`).
 */

const BASE = ["id", "user_id", "created_at", "updated_at", "deleted_at"] as const;

export const TABLE_COLUMNS: Record<TableName, readonly string[]> = {
  clients: [...BASE, "name", "phone", "email", "address", "notes"],
  jobs: [
    ...BASE,
    "client_id",
    "title",
    "type",
    "status",
    "address",
    "scheduled_date",
    "scheduled_time",
    "estimated_hours",
    "price_total",
    "material_cost",
    "start_date",
    "end_date",
    "notes",
    "in_portfolio",
    "portfolio_description",
  ],
  job_measurements: [...BASE, "job_id", "client_id", "kind", "label", "data", "notes"],
  job_photos: [
    ...BASE,
    "job_id",
    "measurement_id",
    "stage",
    "storage_path",
    "local_key",
    "caption",
  ],
  job_materials: [
    ...BASE,
    "job_id",
    "material_id",
    "name",
    "quantity",
    "unit",
    "unit_price",
    "purchased",
  ],
  materials: [...BASE, "name", "category", "quantity", "unit", "price", "supplier", "notes"],
  payments: [...BASE, "job_id", "client_id", "amount", "kind", "method", "paid_at", "note"],
  expenses: [
    ...BASE,
    "job_id",
    "category",
    "amount",
    "spent_at",
    "note",
    "receipt_path",
    "receipt_local_key",
  ],
  quotes: [
    ...BASE,
    "number",
    "client_id",
    "job_id",
    "status",
    "title",
    "advance",
    "discount",
    "valid_until",
    "notes",
    "sent_at",
    "accepted_at",
  ],
  quote_items: [...BASE, "quote_id", "description", "quantity", "unit", "unit_price", "position"],
  tools: [
    ...BASE,
    "name",
    "brand",
    "model",
    "price",
    "purchased_at",
    "warranty_months",
    "notes",
    "photo_path",
    "photo_local_key",
  ],
  work_sessions: [...BASE, "job_id", "started_at", "ended_at", "duration_minutes", "note"],
  notifications: [...BASE, "kind", "title", "body", "job_id", "due_date", "read_at"],
  settings: [
    ...BASE,
    "full_name",
    "phone",
    "email",
    "company",
    "logo_path",
    "logo_local_key",
    "currency",
    "units",
    "default_rates",
    "expense_categories",
    "material_categories",
    "notification_prefs",
    "vat_percent",
    "quote_terms",
  ],
};

/** Aduce rândul la forma exactă pe care o așteaptă tabelul. */
export function toPayload(table: TableName, row: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const column of TABLE_COLUMNS[table]) {
    payload[column] = row[column] ?? null;
  }
  return payload;
}
