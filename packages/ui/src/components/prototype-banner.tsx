"use client";

import { useT } from "../locale";

function PrototypeBanner() {
  const t = useT();
  return (
    <div
      className="border-b border-amber-300/60 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950 dark:text-amber-50"
      role="status"
    >
      {t("banner.prototype")}
    </div>
  );
}

export { PrototypeBanner };
