import { cookies } from 'next/headers';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, createTranslator, isLanguage } from './index';
import type { LanguageCode } from '@/lib/types/database';

/**
 * Language for a server render. The cookie wins over the stored profile so a
 * language switch takes effect on the very next request, before the profile
 * write has to have landed.
 */
export async function getLanguage(profileLanguage?: string | null): Promise<LanguageCode> {
  const store = await cookies();
  const cookieLang = store.get(LANGUAGE_COOKIE)?.value;
  if (isLanguage(cookieLang)) return cookieLang;
  if (isLanguage(profileLanguage)) return profileLanguage;
  return DEFAULT_LANGUAGE;
}

export async function getT(profileLanguage?: string | null) {
  const lang = await getLanguage(profileLanguage);
  return { lang, t: createTranslator(lang) };
}
