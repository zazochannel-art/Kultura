import type { TranslationKey } from '@/lib/i18n';

/**
 * What every server action hands back to a form.
 *
 * Errors are translation keys, not sentences: the action runs on the server
 * where the user's language is a cookie read away, but the component that
 * renders the message already has the translator, so passing the key keeps one
 * source of truth for the wording.
 */
export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: TranslationKey;
  /** Field-level errors, keyed by input name. */
  fields?: Record<string, TranslationKey>;
  message?: TranslationKey;
  data?: T;
}

export const success = <T>(data?: T, message?: TranslationKey): ActionResult<T> => ({
  ok: true,
  data,
  message,
});

export const failure = (
  error: TranslationKey,
  fields?: Record<string, TranslationKey>,
): ActionResult<never> => ({ ok: false, error, fields });

export const fieldFailure = (fields: Record<string, TranslationKey>): ActionResult<never> => ({
  ok: false,
  fields,
});

export const IDLE: ActionResult = { ok: false };
