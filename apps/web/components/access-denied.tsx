"use client";

import { ErrorState, useT } from "@riskflow/ui";

export function AccessDenied() {
  const t = useT();
  return (
    <ErrorState
      title={t("accessDenied.title")}
      description={t("accessDenied.description")}
      action={
        <a className="text-sm font-medium text-primary underline" href="/tenants">
          {t("accessDenied.switchOrg")}
        </a>
      }
    />
  );
}
