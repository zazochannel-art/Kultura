/**
 * Modelul de date al aplicației.
 *
 * Tipurile de aici oglindesc 1:1 tabelele din Supabase (vezi
 * `supabase/migrations`). Toate rândurile au `id`, `user_id`, `created_at` și
 * `updated_at` pentru ca sincronizarea local-first să poată face merge
 * determinist (last-write-wins pe `updated_at`).
 */

export type ID = string;

export interface BaseRow {
  id: ID;
  user_id: ID;
  created_at: string;
  updated_at: string;
  /** Marcaj de ștergere logică — necesar pentru sincronizare. */
  deleted_at?: string | null;
  /** Pus de server la fiecare scriere; este cursorul de sincronizare. */
  synced_at?: string;
}

/* ------------------------------------------------------------------ */
/* Enumerări                                                           */
/* ------------------------------------------------------------------ */

export const JOB_TYPES = ["stairs", "parquet", "plinth", "other"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = [
  "quote",
  "confirmed",
  "materials",
  "in_progress",
  "done",
  "issue",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const PAYMENT_KINDS = ["advance", "partial", "final"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_METHODS = ["cash", "card", "transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const EXPENSE_CATEGORIES = [
  "materials",
  "fuel",
  "tools",
  "transport",
  "parking",
  "car",
  "consumables",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PHOTO_STAGES = ["before", "during", "after"] as const;
export type PhotoStage = (typeof PHOTO_STAGES)[number];

export const NOTIFICATION_KINDS = [
  "job_tomorrow",
  "job_today",
  "payment_due",
  "tool_warranty",
  "materials_missing",
  "quote_pending",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/* ------------------------------------------------------------------ */
/* Tabele                                                              */
/* ------------------------------------------------------------------ */

export interface Client extends BaseRow {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

export interface Job extends BaseRow {
  client_id: ID | null;
  title: string;
  type: JobType;
  status: JobStatus;
  address: string | null;
  /** ISO date (YYYY-MM-DD) — ziua programată. */
  scheduled_date: string | null;
  /** HH:mm */
  scheduled_time: string | null;
  estimated_hours: number | null;
  price_total: number;
  /** Cost estimat al materialelor introdus manual (opțional). */
  material_cost: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  /** Vizibil în portofoliu (doar lucrări finalizate). */
  in_portfolio: boolean;
  portfolio_description: string | null;
}

/** Valorile măsurătorilor, în funcție de tip. Stocate ca JSON. */
export interface StairsMeasurement {
  steps?: number;
  width?: number;
  length?: number;
  height?: number;
  depth?: number;
  thickness?: number;
  landings?: number;
  angle?: number;
  radius?: number;
}

export interface ParquetMeasurement {
  area?: number;
  parquet_type?: string;
  waste_percent?: number;
  rooms?: number;
}

export interface PlinthMeasurement {
  linear_meters?: number;
  plinth_type?: string;
  corners_outer?: number;
  corners_inner?: number;
  profiles?: number;
  joints?: number;
  piece_length?: number;
}

export interface OtherMeasurement {
  quantity?: number;
  unit?: string;
  label?: string;
}

export type MeasurementData =
  | StairsMeasurement
  | ParquetMeasurement
  | PlinthMeasurement
  | OtherMeasurement;

export interface JobMeasurement extends BaseRow {
  job_id: ID | null;
  /** Măsurătorile rapide pot exista fără lucrare — atunci reținem clientul. */
  client_id: ID | null;
  kind: JobType;
  label: string | null;
  data: MeasurementData;
  notes: string | null;
}

export interface JobPhoto extends BaseRow {
  job_id: ID | null;
  measurement_id: ID | null;
  stage: PhotoStage;
  /** Cale în Supabase Storage (bucket `job-photos`). */
  storage_path: string | null;
  /** Fallback local: cheia blobului din IndexedDB când nu există rețea. */
  local_key: string | null;
  caption: string | null;
}

export interface JobMaterial extends BaseRow {
  job_id: ID;
  material_id: ID | null;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  purchased: boolean;
}

export interface Material extends BaseRow {
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  price: number;
  supplier: string | null;
  notes: string | null;
}

export interface Payment extends BaseRow {
  job_id: ID | null;
  client_id: ID | null;
  amount: number;
  kind: PaymentKind;
  method: PaymentMethod;
  paid_at: string;
  note: string | null;
}

export interface Expense extends BaseRow {
  job_id: ID | null;
  category: ExpenseCategory;
  amount: number;
  spent_at: string;
  note: string | null;
  receipt_path: string | null;
  receipt_local_key: string | null;
}

export interface Quote extends BaseRow {
  number: number;
  client_id: ID | null;
  job_id: ID | null;
  status: QuoteStatus;
  title: string;
  advance: number;
  discount: number;
  valid_until: string | null;
  notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
}

export interface QuoteItem extends BaseRow {
  quote_id: ID;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  position: number;
}

export interface Tool extends BaseRow {
  name: string;
  brand: string | null;
  model: string | null;
  price: number | null;
  purchased_at: string | null;
  warranty_months: number | null;
  notes: string | null;
  photo_path: string | null;
  photo_local_key: string | null;
}

export interface WorkSession extends BaseRow {
  job_id: ID;
  started_at: string;
  ended_at: string | null;
  /** Calculat la oprire, în minute. */
  duration_minutes: number | null;
  note: string | null;
}

export interface AppNotification extends BaseRow {
  kind: NotificationKind;
  title: string;
  body: string | null;
  job_id: ID | null;
  due_date: string | null;
  read_at: string | null;
}

export interface DefaultRates {
  stair_step: number;
  stair_riser: number;
  landing: number;
  railing: number;
  parquet_m2: number;
  plinth_m: number;
  hourly: number;
}

export interface NotificationPrefs {
  job_tomorrow: boolean;
  job_today: boolean;
  payment_due: boolean;
  tool_warranty: boolean;
  materials_missing: boolean;
  quote_pending: boolean;
}

export interface Settings extends BaseRow {
  full_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  logo_path: string | null;
  logo_local_key: string | null;
  currency: string;
  /** `metric` (m, m²) sau `imperial` (ft, ft²). */
  units: "metric" | "imperial";
  default_rates: DefaultRates;
  expense_categories: string[];
  material_categories: string[];
  notification_prefs: NotificationPrefs;
  vat_percent: number;
  quote_terms: string | null;
}

/* ------------------------------------------------------------------ */
/* Registrul tabelelor sincronizate                                    */
/* ------------------------------------------------------------------ */

export interface Tables {
  clients: Client;
  jobs: Job;
  job_measurements: JobMeasurement;
  job_photos: JobPhoto;
  job_materials: JobMaterial;
  materials: Material;
  payments: Payment;
  expenses: Expense;
  quotes: Quote;
  quote_items: QuoteItem;
  tools: Tool;
  work_sessions: WorkSession;
  notifications: AppNotification;
  settings: Settings;
}

export type TableName = keyof Tables;

export const TABLE_NAMES: TableName[] = [
  "clients",
  "jobs",
  "job_measurements",
  "job_photos",
  "job_materials",
  "materials",
  "payments",
  "expenses",
  "quotes",
  "quote_items",
  "tools",
  "work_sessions",
  "notifications",
  "settings",
];

/** Câmpurile pe care le completează stratul de date, nu apelantul. */
export type NewRow<T extends BaseRow> = Omit<
  T,
  "id" | "user_id" | "created_at" | "updated_at" | "deleted_at"
> &
  Partial<Pick<T, "id">>;
