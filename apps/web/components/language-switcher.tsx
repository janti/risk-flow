"use client";

import { LOCALES, type AppLocale, type MessageKey } from "@riskflow/shared";
import { useLocale, useT } from "@riskflow/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onChange(next: AppLocale) {
    setPending(true);
    await fetch("/api/v1/locale", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    router.refresh();
    setPending(false);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t("locale.label")}</span>
      <select
        className="rounded-md border bg-background px-2 py-1 text-sm"
        aria-label={t("locale.label")}
        data-testid="language-switcher"
        value={locale}
        disabled={pending}
        onChange={(event) => void onChange(event.target.value as AppLocale)}
      >
        {LOCALES.map((item) => (
          <option key={item} value={item}>
            {t(`locale.${item}` as MessageKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
