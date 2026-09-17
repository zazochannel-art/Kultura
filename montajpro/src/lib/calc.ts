import { num } from "./utils";
import type {
  MeasurementData,
  JobType,
  ParquetMeasurement,
  PlinthMeasurement,
  StairsMeasurement,
  OtherMeasurement,
} from "./types";

/**
 * Calcule automate pentru măsurători și pentru calculatorul de preț.
 *
 * Toate dimensiunile liniare sunt în centimetri (cum se măsoară pe șantier),
 * iar rezultatele derivate sunt în metri / metri pătrați.
 */

export interface DerivedValue {
  label: string;
  value: string;
  hint?: string;
}

const CM2_PER_M2 = 10_000;

export function derivedStairs(m: StairsMeasurement): DerivedValue[] {
  const out: DerivedValue[] = [];
  const steps = num(m.steps);
  const width = num(m.width);
  const depth = num(m.depth);
  const height = num(m.height);
  const thickness = num(m.thickness);
  const landings = num(m.landings);

  if (steps && width && depth) {
    const treadArea = (steps * width * depth) / CM2_PER_M2;
    out.push({
      label: "Suprafață trepte",
      value: `${treadArea.toFixed(2)} m²`,
      hint: `${steps} × ${width}×${depth} cm`,
    });
  }
  if (steps && width && height) {
    const riserArea = (steps * width * height) / CM2_PER_M2;
    out.push({
      label: "Suprafață contratrepte",
      value: `${riserArea.toFixed(2)} m²`,
      hint: `${steps} × ${width}×${height} cm`,
    });
  }
  if (steps && height) {
    out.push({
      label: "Înălțime totală",
      value: `${((steps * height) / 100).toFixed(2)} m`,
      hint: `${steps} trepte × ${height} cm`,
    });
  }
  if (steps && depth) {
    out.push({
      label: "Desfășurare orizontală",
      value: `${((steps * depth) / 100).toFixed(2)} m`,
    });
  }
  if (height && depth) {
    const angle = (Math.atan(height / depth) * 180) / Math.PI;
    out.push({
      label: "Unghi calculat",
      value: `${angle.toFixed(1)}°`,
      hint: "din înălțime / adâncime treaptă",
    });
  }
  if (steps && width && depth && thickness) {
    const volume = (steps * width * depth * thickness) / 1_000_000;
    out.push({
      label: "Volum lemn trepte",
      value: `${volume.toFixed(3)} m³`,
    });
  }
  if (landings) {
    out.push({ label: "Podeste", value: `${landings}` });
  }
  return out;
}

export function derivedParquet(m: ParquetMeasurement): DerivedValue[] {
  const area = num(m.area);
  const waste = num(m.waste_percent, 10);
  if (!area) return [];
  const withWaste = area * (1 + waste / 100);
  return [
    {
      label: "Suprafață cu pierdere",
      value: `${withWaste.toFixed(2)} m²`,
      hint: `${area} m² + ${waste}% pierdere`,
    },
    {
      label: "Material de comandat",
      value: `${Math.ceil(withWaste)} m²`,
      hint: "rotunjit în sus",
    },
  ];
}

export function derivedPlinth(m: PlinthMeasurement): DerivedValue[] {
  const meters = num(m.linear_meters);
  const pieceLength = num(m.piece_length, 2.4);
  const corners = num(m.corners_outer) + num(m.corners_inner);
  if (!meters) return [];
  const out: DerivedValue[] = [
    {
      label: "Bucăți necesare",
      value: `${Math.ceil(meters / (pieceLength || 2.4))} buc`,
      hint: `${meters} m / ${pieceLength || 2.4} m per bucată`,
    },
  ];
  if (corners) {
    out.push({
      label: "Colțuri total",
      value: `${corners} buc`,
      hint: `${num(m.corners_outer)} exterioare, ${num(m.corners_inner)} interioare`,
    });
  }
  if (num(m.joints)) {
    out.push({ label: "Îmbinări", value: `${num(m.joints)} buc` });
  }
  return out;
}

export function derivedOther(m: OtherMeasurement): DerivedValue[] {
  if (!num(m.quantity)) return [];
  return [
    {
      label: m.label || "Cantitate",
      value: `${num(m.quantity)} ${m.unit || "buc"}`,
    },
  ];
}

export function derivedValues(kind: JobType, data: MeasurementData): DerivedValue[] {
  switch (kind) {
    case "stairs":
      return derivedStairs(data as StairsMeasurement);
    case "parquet":
      return derivedParquet(data as ParquetMeasurement);
    case "plinth":
      return derivedPlinth(data as PlinthMeasurement);
    default:
      return derivedOther(data as OtherMeasurement);
  }
}

/** Rezumat scurt pentru cardurile din listă. */
export function measurementSummary(kind: JobType, data: MeasurementData): string {
  if (kind === "stairs") {
    const m = data as StairsMeasurement;
    const parts = [
      m.steps ? `${m.steps} trepte` : null,
      m.width ? `l. ${m.width} cm` : null,
      m.landings ? `${m.landings} podest${m.landings > 1 ? "e" : ""}` : null,
    ].filter(Boolean);
    return parts.join(" · ") || "Fără valori";
  }
  if (kind === "parquet") {
    const m = data as ParquetMeasurement;
    const parts = [
      m.area ? `${m.area} m²` : null,
      m.parquet_type || null,
      m.waste_percent ? `+${m.waste_percent}%` : null,
    ].filter(Boolean);
    return parts.join(" · ") || "Fără valori";
  }
  if (kind === "plinth") {
    const m = data as PlinthMeasurement;
    const parts = [
      m.linear_meters ? `${m.linear_meters} m` : null,
      m.plinth_type || null,
      num(m.corners_outer) + num(m.corners_inner)
        ? `${num(m.corners_outer) + num(m.corners_inner)} colțuri`
        : null,
    ].filter(Boolean);
    return parts.join(" · ") || "Fără valori";
  }
  const m = data as OtherMeasurement;
  return m.quantity ? `${m.quantity} ${m.unit || "buc"}` : "Fără valori";
}

/* ------------------------------------------------------------------ */
/* Calculator de preț                                                  */
/* ------------------------------------------------------------------ */

export interface CalcLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export function lineTotal(line: Pick<CalcLine, "quantity" | "unit_price">): number {
  return num(line.quantity) * num(line.unit_price);
}

export function calcTotal(lines: Pick<CalcLine, "quantity" | "unit_price">[]): number {
  return lines.reduce((acc, line) => acc + lineTotal(line), 0);
}

/* ------------------------------------------------------------------ */
/* Finanțe                                                             */
/* ------------------------------------------------------------------ */

export interface JobMoney {
  price: number;
  paid: number;
  advance: number;
  rest: number;
  materialsCost: number;
  expensesCost: number;
  profit: number;
  margin: number;
}

export function jobMoney(input: {
  price: number;
  payments: { amount: number; kind: string }[];
  materials: { quantity: number; unit_price: number }[];
  expenses: { amount: number }[];
  extraMaterialCost?: number | null;
}): JobMoney {
  const price = num(input.price);
  const paid = input.payments.reduce((acc, p) => acc + num(p.amount), 0);
  const advance = input.payments
    .filter((p) => p.kind === "advance")
    .reduce((acc, p) => acc + num(p.amount), 0);
  const materialsCost =
    input.materials.reduce(
      (acc, m) => acc + num(m.quantity) * num(m.unit_price),
      0,
    ) + num(input.extraMaterialCost);
  const expensesCost = input.expenses.reduce((acc, e) => acc + num(e.amount), 0);
  const profit = price - materialsCost - expensesCost;
  return {
    price,
    paid,
    advance,
    rest: price - paid,
    materialsCost,
    expensesCost,
    profit,
    margin: price > 0 ? (profit / price) * 100 : 0,
  };
}

/** Durata totală lucrată, în minute, inclusiv sesiunea în desfășurare. */
export function totalWorkedMinutes(
  sessions: { started_at: string; ended_at: string | null; duration_minutes: number | null }[],
  now: number = Date.now(),
): number {
  return sessions.reduce((acc, s) => {
    if (s.ended_at) return acc + (num(s.duration_minutes) || 0);
    const started = new Date(s.started_at).getTime();
    if (Number.isNaN(started)) return acc;
    return acc + Math.max(0, Math.round((now - started) / 60_000));
  }, 0);
}

export function warrantyEndDate(
  purchasedAt: string | null,
  months: number | null,
): Date | null {
  if (!purchasedAt || !months) return null;
  const date = new Date(purchasedAt);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return date;
}

export function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const target = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);
}
