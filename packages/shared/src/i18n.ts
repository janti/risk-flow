export const LOCALES = ["fi", "sv", "en"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "fi";

export const LOCALE_COOKIE = "riskflow_locale";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function localeTag(locale: AppLocale): string {
  if (locale === "sv") {
    return "sv-SE";
  }
  if (locale === "en") {
    return "en-GB";
  }
  return "fi-FI";
}

export function parseLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}
