'use client';
import { createContext, useContext } from 'react';
import type { Dictionary, Locale, TKey } from '@/lib/i18n';

interface Ctx { locale: Locale; dict: Dictionary; t: (k: TKey) => string }
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: React.ReactNode }) {
  const t = (k: TKey) => dict[k] ?? k;
  return <I18nContext.Provider value={{ locale, dict, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT doit être utilisé dans I18nProvider');
  return ctx;
}
