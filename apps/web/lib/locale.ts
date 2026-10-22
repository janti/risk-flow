import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isAppLocale,
  type AppLocale,
} from "@riskflow/shared";
import { getCurrentUser } from "./current-access";

export async function resolveRequestLocale(): Promise<AppLocale> {
  const user = await getCurrentUser();
  if (user) {
    return user.locale;
  }
  const jar = await cookies();
  const cookie = jar.get(LOCALE_COOKIE)?.value;
  return isAppLocale(cookie) ? cookie : DEFAULT_LOCALE;
}

export function localeCookieHeader(locale: AppLocale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`;
}

export function withLocaleCookie(response: Response, locale: AppLocale): Response {
  response.headers.append("Set-Cookie", localeCookieHeader(locale));
  return response;
}
