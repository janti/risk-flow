"use client";

import { ErrorState, Spinner, useT } from "@riskflow/ui";
import type { HeatmapResult } from "@riskflow/risk-engine";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";
import { RiskMatrix } from "./risk-matrix";

type AnalyticsHeatmapProps = {
  tenantSlug: string;
};

export function AnalyticsHeatmap({ tenantSlug }: AnalyticsHeatmapProps) {
  const t = useT();
  const apiError = useApiError();
  const router = useRouter();
  const [type, setType] = useState<"inherent" | "residual">("residual");
  const [heatmap, setHeatmap] = useState<HeatmapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void apiRequest<{ heatmap: HeatmapResult }>(
      `/api/v1/tenants/${tenantSlug}/analytics/heatmap?assessmentType=${type}`,
    ).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(apiError(result));
        return;
      }
      setError(null);
      setHeatmap(result.data.heatmap);
    });
  }, [apiError, tenantSlug, type]);

  if (error) {
    return <ErrorState title={t("analytics.heatmapError")} description={error} />;
  }
  if (!heatmap) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border bg-card">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  return (
    <RiskMatrix
      heatmap={heatmap}
      busy={loading}
      selected={null}
      onTypeChange={setType}
      onSelect={(cell) => {
        if (!cell) {
          router.push(`/t/${tenantSlug}/risks`);
          return;
        }
        router.push(
          `/t/${tenantSlug}/risks?assessmentType=${type}&likelihood=${cell.likelihood}&impact=${cell.impact}`,
        );
      }}
    />
  );
}
