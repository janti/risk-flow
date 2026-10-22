"use client";

import { useLocale } from "@riskflow/ui";
import { useCallback } from "react";
import { apiErrorText, type ApiFailure } from "./api-client";

export function useApiError() {
  const locale = useLocale();
  return useCallback((result: ApiFailure) => apiErrorText(locale, result), [locale]);
}
