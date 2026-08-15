// Kultura UI translations — locale registry.
//
// The three packs used to live in this file and were all shipped on every load
// (~32KB gzipped) even though a session only ever uses one language. They now
// live in ./i18n/<lang>.js and are pulled in on demand.
//
// Romanian is imported statically because it is both the default language and
// the fallback `t()` uses for any key missing from another pack. English and
// Russian are dynamic imports, so a Romanian session — the overwhelming
// majority here — never downloads them at all.
import ro from './i18n/ro.js';

export const SUPPORTED_LANGS = ['ro', 'en', 'ru'];

// Packs currently in memory. Grows as locales load; `ro` is always present.
export const translations = { ro };

const LOADERS = {
  en: () => import('./i18n/en.js'),
  ru: () => import('./i18n/ru.js'),
};

// Ensure `translations[lang]` is populated before the UI renders in it. Safe to
// call repeatedly and for unknown languages. If the fetch fails (bad network
// mid-switch) the pack stays absent and `t()` falls back to Romanian — the same
// path as a missing key, never a crash.
export async function ensureLocale(lang) {
  if (translations[lang] || !LOADERS[lang]) return;
  try {
    translations[lang] = (await LOADERS[lang]()).default;
  } catch (_) {
    /* keep the Romanian fallback */
  }
}
