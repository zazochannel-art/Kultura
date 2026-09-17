import type {
  DefaultRates,
  ExpenseCategory,
  JobStatus,
  JobType,
  NotificationPrefs,
  PaymentKind,
  PaymentMethod,
  PhotoStage,
  QuoteStatus,
} from "./types";

/** Etichete în română pentru toate enumerările din UI. */

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  stairs: "Scară",
  parquet: "Parchet",
  plinth: "Plintă",
  other: "Altceva",
};

export const JOB_TYPE_EMOJI: Record<JobType, string> = {
  stairs: "🪜",
  parquet: "🪵",
  plinth: "📏",
  other: "🔧",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  quote: "Ofertă",
  confirmed: "Confirmată",
  materials: "Materiale",
  in_progress: "În lucru",
  done: "Finalizată",
  issue: "Problemă",
};

/**
 * Culorile statusurilor. Clasele sunt scrise complet (nu compuse dinamic)
 * pentru ca Tailwind să le poată detecta la build.
 */
export const JOB_STATUS_CLASSES: Record<JobStatus, string> = {
  quote: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  confirmed: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  materials: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  in_progress: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  issue: "bg-red-500/15 text-red-300 border-red-500/30",
};

export const JOB_STATUS_DOT: Record<JobStatus, string> = {
  quote: "bg-zinc-400",
  confirmed: "bg-violet-400",
  materials: "bg-amber-400",
  in_progress: "bg-cyan-400",
  done: "bg-emerald-400",
  issue: "bg-red-400",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Ciornă",
  sent: "Trimisă",
  accepted: "Acceptată",
  rejected: "Refuzată",
};

export const QUOTE_STATUS_CLASSES: Record<QuoteStatus, string> = {
  draft: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  sent: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
};

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  advance: "Avans",
  partial: "Plată parțială",
  final: "Plată finală",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Numerar",
  card: "Card",
  transfer: "Transfer",
  other: "Altfel",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  materials: "Materiale",
  fuel: "Combustibil",
  tools: "Scule",
  transport: "Transport",
  parking: "Parcare",
  car: "Mașină",
  consumables: "Consumabile",
  other: "Altele",
};

export const PHOTO_STAGE_LABELS: Record<PhotoStage, string> = {
  before: "Înainte",
  during: "În timpul lucrării",
  after: "După",
};

export const CURRENCIES = [
  { code: "MDL", label: "Leu moldovenesc (MDL)", symbol: "L" },
  { code: "RON", label: "Leu românesc (RON)", symbol: "lei" },
  { code: "EUR", label: "Euro (EUR)", symbol: "€" },
  { code: "USD", label: "Dolar american (USD)", symbol: "$" },
  { code: "UAH", label: "Grivnă (UAH)", symbol: "₴" },
  { code: "GBP", label: "Liră sterlină (GBP)", symbol: "£" },
] as const;

export const DEFAULT_CURRENCY = "MDL";

export const DEFAULT_RATES: DefaultRates = {
  stair_step: 0,
  stair_riser: 0,
  landing: 0,
  railing: 0,
  parquet_m2: 0,
  plinth_m: 0,
  hourly: 0,
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  job_tomorrow: true,
  job_today: true,
  payment_due: true,
  tool_warranty: true,
  materials_missing: true,
  quote_pending: true,
};

export const DEFAULT_MATERIAL_CATEGORIES = [
  "Lemn",
  "Parchet",
  "Plintă",
  "Adezivi",
  "Șuruburi",
  "Lac / ulei",
  "Consumabile",
  "Altele",
];

export const UNITS = ["buc", "m", "m²", "m³", "kg", "l", "set", "pachet"];

/** Unitatea implicită de măsură pentru fiecare tip de lucrare. */
export const JOB_TYPE_UNIT: Record<JobType, string> = {
  stairs: "buc",
  parquet: "m²",
  plinth: "m",
  other: "buc",
};
