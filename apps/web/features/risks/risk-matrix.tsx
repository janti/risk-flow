"use client";

import { cn, Spinner, useT } from "@riskflow/ui";
import type { HeatmapResult } from "@riskflow/risk-engine";

type RiskMatrixProps = {
  heatmap: HeatmapResult;
  selected: { likelihood: number; impact: number } | null;
  onSelect: (cell: { likelihood: number; impact: number } | null) => void;
  onTypeChange: (assessmentType: "inherent" | "residual") => void;
  busy?: boolean;
};

const RATING_CLASS: Record<string, string> = {
  low: "bg-risk-low/20",
  medium: "bg-risk-medium/25",
  high: "bg-risk-high/25",
  critical: "bg-risk-critical/30",
};

export function RiskMatrix({ heatmap, selected, onSelect, onTypeChange, busy = false }: RiskMatrixProps) {
  const t = useT();
  const size = heatmap.size;
  const impacts = Array.from({ length: size }, (_, index) => size - index);
  const likelihoods = Array.from({ length: size }, (_, index) => index + 1);

  return (
    <section className="relative space-y-3 rounded-lg border bg-card p-4" data-testid="risk-matrix" aria-busy={busy}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("risks.matrix")}</h2>
        <label className="flex items-center gap-2 text-sm">
          {t("risks.type")}
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={heatmap.assessmentType}
            onChange={(event) => onTypeChange(event.target.value as "inherent" | "residual")}
            data-testid="matrix-type"
          >
            <option value="residual">{t("risks.residual")}</option>
            <option value="inherent">{t("risks.inherent")}</option>
          </select>
        </label>
      </div>
      <div className="relative overflow-x-auto">
        {busy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/70">
            <Spinner label={t("common.loading")} />
          </div>
        ) : null}
        <table className="border-collapse text-center text-sm">
          <caption className="sr-only">{t("risks.matrixCaption")}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-muted-foreground">
                {t("risks.matrixAxes")}
              </th>
              {likelihoods.map((likelihood) => (
                <th scope="col" key={likelihood} className="px-2 py-1 font-medium">
                  {likelihood}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {impacts.map((impact) => (
              <tr key={impact}>
                <th scope="row" className="px-2 py-1 text-left font-medium">
                  {impact}
                </th>
                {likelihoods.map((likelihood) => {
                  const cell = heatmap.cells.find((item) => item.likelihood === likelihood && item.impact === impact);
                  const isSelected = selected?.likelihood === likelihood && selected?.impact === impact;
                  const count = cell?.count ?? 0;
                  return (
                    <td key={`${likelihood}-${impact}`} className="p-1">
                      <button
                        type="button"
                        className={cn(
                          "flex h-12 min-h-11 w-12 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-shadow hover:shadow-md hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          RATING_CLASS[cell?.rating ?? "low"],
                          count === 0 ? "text-muted-foreground" : "",
                          isSelected ? "ring-2 ring-ring" : "",
                        )}
                        aria-pressed={isSelected}
                        aria-label={t("risks.matrixCell", { likelihood, impact, count })}
                        title={t("risks.matrixCell", { likelihood, impact, count })}
                        data-testid={`matrix-cell-${likelihood}-${impact}`}
                        onClick={() => onSelect(isSelected ? null : { likelihood, impact })}
                      >
                        {count}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
