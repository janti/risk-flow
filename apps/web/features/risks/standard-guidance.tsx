"use client";

import {
  categoryGuidance,
  frameworksForCategory,
  treatmentStrategyKey,
} from "@riskflow/risk-engine/guidance";
import { useT } from "@riskflow/ui";

type StandardGuidanceProps = {
  categoryCode: string;
  surface: "identify" | "assess" | "treat";
  strategy?: "avoid" | "reduce" | "share" | "accept";
};

export function StandardGuidance({ categoryCode, surface, strategy }: StandardGuidanceProps) {
  const t = useT();
  const pack = categoryGuidance(categoryCode);
  const frameworks = frameworksForCategory(categoryCode);
  const bodyKey = surface === "identify" ? pack.identifyKey : surface === "assess" ? pack.promptsKey : pack.treatKey;

  return (
    <aside className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm" data-testid="standard-guidance">
      <h2 className="font-medium">{t("guidance.title")}</h2>
      <p>{t("guidance.process")}</p>
      <p>{t(bodyKey)}</p>
      {surface === "identify" ? <p>{t(pack.promptsKey)}</p> : null}
      {surface === "treat" && strategy ? <p>{t(treatmentStrategyKey(strategy))}</p> : null}
      <ul className="flex flex-wrap gap-2">
        {frameworks.map((framework) => (
          <li key={framework.id}>
            <a
              className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={framework.href}
              rel="noreferrer"
              target="_blank"
            >
              {t(framework.labelKey)}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("guidance.disclaimer")}</p>
    </aside>
  );
}
