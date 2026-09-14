'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CurrencyCode, LanguageCode } from '@/lib/types/database';
import { createTranslator, localeTag, type Translate } from './index';

interface I18nValue {
  lang: LanguageCode;
  locale: string;
  currency: CurrencyCode;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  lang,
  currency,
  children,
}: {
  lang: LanguageCode;
  currency: CurrencyCode;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ lang, locale: localeTag(lang), currency, t: createTranslator(lang) }),
    [lang, currency],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export function useT(): Translate {
  return useI18n().t;
}
