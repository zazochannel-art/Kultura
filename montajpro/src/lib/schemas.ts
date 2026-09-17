import { z } from "zod";
import { EXPENSE_CATEGORIES, JOB_STATUSES, JOB_TYPES, PAYMENT_KINDS, PAYMENT_METHODS } from "./types";

/** Schemele de validare pentru formularele aplicației. */

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Numele trebuie să aibă cel puțin 2 caractere"),
  phone: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), "Email invalid")
    .transform((value) => (value ? value : null)),
  address: optionalText,
  notes: optionalText,
});

export const jobSchema = z.object({
  title: z.string().trim().min(2, "Adaugă un titlu pentru lucrare"),
  client_id: z.string().nullable(),
  type: z.enum(JOB_TYPES),
  status: z.enum(JOB_STATUSES),
  address: optionalText,
  scheduled_date: z.string().nullable().optional(),
  scheduled_time: z.string().nullable().optional(),
  estimated_hours: z.number().min(0).nullable().optional(),
  price_total: z.number().min(0, "Prețul nu poate fi negativ"),
  advance: z.number().min(0).optional(),
  notes: optionalText,
});

export const paymentSchema = z.object({
  amount: z.number().positive("Suma trebuie să fie mai mare ca 0"),
  kind: z.enum(PAYMENT_KINDS),
  method: z.enum(PAYMENT_METHODS),
  paid_at: z.string().min(1, "Alege data"),
  note: optionalText,
});

export const expenseSchema = z.object({
  amount: z.number().positive("Suma trebuie să fie mai mare ca 0"),
  category: z.enum(EXPENSE_CATEGORIES),
  spent_at: z.string().min(1, "Alege data"),
  job_id: z.string().nullable().optional(),
  note: optionalText,
});

export const materialSchema = z.object({
  name: z.string().trim().min(2, "Adaugă numele materialului"),
  category: z.string().nullable().optional(),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  price: z.number().min(0),
  supplier: optionalText,
  notes: optionalText,
});

export const jobMaterialSchema = z.object({
  name: z.string().trim().min(2, "Adaugă numele materialului"),
  quantity: z.number().positive("Cantitatea trebuie să fie mai mare ca 0"),
  unit: z.string().min(1),
  unit_price: z.number().min(0),
  purchased: z.boolean(),
  material_id: z.string().nullable().optional(),
});

export const toolSchema = z.object({
  name: z.string().trim().min(2, "Adaugă numele sculei"),
  brand: optionalText,
  model: optionalText,
  price: z.number().min(0).nullable().optional(),
  purchased_at: z.string().nullable().optional(),
  warranty_months: z.number().min(0).max(240).nullable().optional(),
  notes: optionalText,
});

export const quoteSchema = z.object({
  title: z.string().trim().min(2, "Adaugă un titlu"),
  client_id: z.string().nullable(),
  valid_until: z.string().nullable().optional(),
  advance: z.number().min(0),
  discount: z.number().min(0),
  notes: optionalText,
});

export const authSchema = z.object({
  email: z.string().trim().email("Email invalid"),
  password: z.string().min(6, "Parola trebuie să aibă cel puțin 6 caractere"),
});

export const settingsSchema = z.object({
  full_name: optionalText,
  phone: optionalText,
  email: optionalText,
  company: optionalText,
  currency: z.string().min(3),
  units: z.enum(["metric", "imperial"]),
  vat_percent: z.number().min(0).max(100),
  quote_terms: optionalText,
});
