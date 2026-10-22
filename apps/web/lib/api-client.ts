import { translateError, type AppLocale } from "@riskflow/shared";

export type ApiSuccess<T> = {
  ok: true;
  status: number;
  data: T;
  meta: Record<string, unknown>;
};

export type ApiFailure = {
  ok: false;
  status: number;
  message: string;
  code?: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function apiErrorText(locale: AppLocale, result: ApiFailure): string {
  return translateError(locale, result.code, result.message);
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    meta?: Record<string, unknown>;
    error?: { message?: string; code?: string };
  } | null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: body?.error?.message ?? "Request failed.",
      code: body?.error?.code ?? "request_failed",
    };
  }
  return { ok: true, status: response.status, data: body?.data as T, meta: body?.meta ?? {} };
}
