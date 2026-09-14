import { z } from 'zod';
import { parseAmount } from '@/lib/format';

/** A money field as typed by a person: "1.234,56", "1,234.56" or "1234.56". */
export const amountField = z
  .string()
  .transform((value) => parseAmount(value))
  .refine((value) => Number.isFinite(value), { message: 'invalid' });

export const positiveAmount = amountField.refine((value) => value > 0, { message: 'positive' });

export const nonNegativeAmount = amountField.refine((value) => value >= 0, {
  message: 'non_negative',
});

export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'date' })
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'date' });

export const uuidField = z.string().uuid();

export const optionalUuid = z
  .string()
  .transform((value) => (value === '' || value === 'none' ? null : value))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: 'uuid',
  });

export const optionalDate = z
  .string()
  .transform((value) => (value === '' ? null : value))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: 'date' });

export const shortText = (max = 120) =>
  z.string().trim().max(max).transform((value) => (value === '' ? null : value));

export const requiredText = (max = 60) => z.string().trim().min(1).max(max);

export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .default('#71717A');

/** Reads a form field as a plain string; FormData entries can also be Files. */
export function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

export function bool(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === 'on' || value === 'true' || value === '1';
}
