export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isAppLocale,
  localeTag,
  parseLocale,
  type AppLocale,
} from "./i18n";
export {
  en,
  fieldTypeMessageKey,
  fi,
  isMessageKey,
  moduleMessageKey,
  permissionMessageKey,
  statusMessageKey,
  sv,
  t,
  translateError,
  type MessageKey,
} from "./messages";
export {
  clientAddress,
  consumeRateLimit,
  createMemoryRateLimitStore,
  type RateLimitResult,
  type RateLimitStore,
} from "./rate-limit";
export {
  assertRuntimeSecrets,
  inspectRuntimeSecrets,
  parseAppEnvironment,
  type AppEnvironment,
  type RuntimeSecretIssue,
} from "./runtime-env";
export { buildSecurityHeaders, type HeaderPair } from "./security-headers";

export type JsonObject = Record<string, unknown>;

export type ApiSuccess<TData, TMeta extends JsonObject = JsonObject> = {
  data: TData;
  meta: TMeta;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};

export function ok<TData>(data: TData, meta: JsonObject = {}): ApiSuccess<TData> {
  return { data, meta };
}

export function fail(
  code: string,
  message: string,
  options?: { details?: unknown; requestId?: string },
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      details: options?.details,
      requestId: options?.requestId,
    },
  };
}

export const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isTenantSlug(value: string): boolean {
  return TENANT_SLUG_PATTERN.test(value);
}

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;
