import type { CalcLine } from "./calc";
import type { JobType } from "./types";

/**
 * Puntea dintre calculator și restul aplicației.
 *
 * Calculul se ține în `sessionStorage` (nu în URL) ca să nu pierdem liniile la
 * refresh și să nu umplem adresa cu date. Citirea este separată de ștergere:
 * pagina care preia ciorna o citește la montare și o curăță într-un efect.
 */
export const CALC_DRAFT_KEY = "montajpro.calc-draft";

export interface CalcDraft {
  kind: JobType;
  lines: CalcLine[];
  total: number;
}

export function saveCalcDraft(draft: CalcDraft) {
  try {
    sessionStorage.setItem(CALC_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Stocarea poate fi blocată — calculul rămâne doar pe ecran.
  }
}

/** Citire fără efecte secundare. */
export function peekCalcDraft(): CalcDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CALC_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CalcDraft;
    return parsed?.lines?.length ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCalcDraft() {
  try {
    sessionStorage.removeItem(CALC_DRAFT_KEY);
  } catch {
    // Nimic de făcut — ciorna expiră oricum odată cu sesiunea.
  }
}
