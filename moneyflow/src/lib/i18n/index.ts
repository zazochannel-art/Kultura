import { ro, type Dictionary, type TranslationKey } from './ro';
import { ru } from './ru';
import { en } from './en';
import type { LanguageCode } from '@/lib/types/database';

export type { Dictionary, TranslationKey };

export const LANGUAGES: LanguageCode[] = ['ro', 'ru', 'en'];
export const DEFAULT_LANGUAGE: LanguageCode = 'ro';
export const LANGUAGE_COOKIE = 'mf_lang';

const PACKS: Record<LanguageCode, Dictionary> = { ro, ru, en };

export function isLanguage(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGES as string[]).includes(value);
}

export function getDictionary(lang: LanguageCode): Dictionary {
  return PACKS[lang] ?? PACKS[DEFAULT_LANGUAGE];
}

export type TranslateValues = Record<string, string | number>;
export type Translate = (key: TranslationKey, values?: TranslateValues) => string;

/**
 * `{placeholder}` interpolation, nothing more. A missing key falls back to
 * Romanian and then to the key itself, so a gap shows up in the UI rather than
 * crashing it.
 */
export function createTranslator(lang: LanguageCode): Translate {
  const dict = getDictionary(lang);
  return (key, values) => {
    const template = dict[key] ?? ro[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match,
    );
  };
}

/** BCP 47 tag for Intl formatting. */
export function localeTag(lang: LanguageCode): string {
  switch (lang) {
    case 'ru':
      return 'ru-RU';
    case 'en':
      return 'en-GB';
    case 'ro':
    default:
      return 'ro-RO';
  }
}
