"use client";

import { DEFAULT_LOCALE, t, type AppLocale, type MessageKey } from "@riskflow/shared";
import { createContext, useCallback, useContext, type ReactNode } from "react";

const LocaleContext = createContext<AppLocale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): AppLocale {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => t(locale, key, vars),
    [locale],
  );
}
