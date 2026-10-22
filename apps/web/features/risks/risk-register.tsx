"use client";

import { Button, EmptyState, ErrorState, PageHeader, PermissionGate, Skeleton, Spinner, useT } from "@riskflow/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HeatmapResult } from "@riskflow/risk-engine";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";
import { RiskFilterBar, type RiskFilters } from "./risk-filter-bar";
import { RiskMatrix } from "./risk-matrix";
import { RiskTable } from "./risk-table";
import type { RiskLookups, RiskPermissions, RiskRecord } from "./types";

const emptyFilters: RiskFilters = {
  q: "",
  status: "",
  categoryId: "",
  orgUnitId: "",
  ownerId: "",
  assessmentType: "residual",
  likelihood: "",
  impact: "",
  createdFrom: "",
  createdTo: "",
};

type RiskRegisterProps = {
  tenantSlug: string;
  permissions: RiskPermissions;
  initialFilters?: Partial<RiskFilters>;
};

export function RiskRegister({ tenantSlug, permissions, initialFilters }: RiskRegisterProps) {
  const t = useT();
  const apiError = useApiError();
  const start: RiskFilters = { ...emptyFilters, ...initialFilters };
  const [filters, setFilters] = useState<RiskFilters>(start);
  const [applied, setApplied] = useState<RiskFilters>(start);
  const [risks, setRisks] = useState<RiskRecord[]>([]);
  const [lookups, setLookups] = useState<RiskLookups | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResult | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean, cursor?: string | null) => {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const params = new URLSearchParams();
      if (applied.q) {
        params.set("q", applied.q);
      }
      if (applied.status) {
        params.set("status", applied.status);
      }
      if (applied.categoryId) {
        params.set("categoryId", applied.categoryId);
      }
      if (applied.orgUnitId) {
        params.set("orgUnitId", applied.orgUnitId);
      }
      if (applied.ownerId) {
        params.set("ownerId", applied.ownerId);
      }
      if (applied.likelihood && applied.impact) {
        params.set("assessmentType", applied.assessmentType);
        params.set("likelihood", applied.likelihood);
        params.set("impact", applied.impact);
      }
      if (applied.createdFrom) {
        params.set("createdFrom", applied.createdFrom);
      }
      if (applied.createdTo) {
        params.set("createdTo", applied.createdTo);
      }
      if (cursor) {
        params.set("cursor", cursor);
      }
      const query = params.toString();
      const result = await apiRequest<{ risks: RiskRecord[] }>(
        `/api/v1/tenants/${tenantSlug}/risks${query ? `?${query}` : ""}`,
      );
      if (!result.ok) {
        setError(apiError(result));
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      setRisks((current) => (reset ? result.data.risks : [...current, ...result.data.risks]));
      setNextCursor(typeof result.meta.nextCursor === "string" ? result.meta.nextCursor : null);
      setLoading(false);
      setLoadingMore(false);
    },
    [apiError, applied, tenantSlug],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    void apiRequest<RiskLookups>(`/api/v1/tenants/${tenantSlug}/risks/lookups`).then((result) => {
      if (result.ok) {
        setLookups(result.data);
      }
    });
  }, [tenantSlug]);

  useEffect(() => {
    setHeatmapLoading(true);
    void apiRequest<{ heatmap: HeatmapResult }>(
      `/api/v1/tenants/${tenantSlug}/risks/matrix?assessmentType=${applied.assessmentType}`,
    ).then((result) => {
      setHeatmapLoading(false);
      if (result.ok) {
        setHeatmap(result.data.heatmap);
      }
    });
  }, [applied.assessmentType, tenantSlug]);

  const createAction = (
    <PermissionGate allowed={permissions.create}>
      <Button asChild>
        <Link href={`/t/${tenantSlug}/risks/new`} data-testid="risk-create">
          {t("risks.new")}
        </Link>
      </Button>
    </PermissionGate>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("risks.title")}
        description={t("risks.description")}
        actions={createAction}
      />
      {heatmap ? (
        <RiskMatrix
          heatmap={heatmap}
          busy={heatmapLoading}
          selected={
            applied.likelihood && applied.impact
              ? { likelihood: Number(applied.likelihood), impact: Number(applied.impact) }
              : null
          }
          onSelect={(cell) => {
            const next = {
              ...applied,
              likelihood: cell ? String(cell.likelihood) : "",
              impact: cell ? String(cell.impact) : "",
            };
            setFilters(next);
            setApplied(next);
          }}
          onTypeChange={(assessmentType) => {
            const next = { ...applied, assessmentType, likelihood: "", impact: "" };
            setFilters(next);
            setApplied(next);
          }}
        />
      ) : heatmapLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-lg border bg-card">
          <Spinner label={t("common.loading")} />
        </div>
      ) : null}
      <RiskFilterBar
        filters={filters}
        lookups={lookups}
        onChange={setFilters}
        onSubmit={() => setApplied(filters)}
      />
      {error ? <ErrorState title={t("risks.loadError")} description={error} onRetry={() => void load(true)} /> : null}
      {!error && loading && risks.length === 0 ? (
        <div className="space-y-2" data-testid="risk-loading">
          <Spinner label={t("common.loading")} className="py-6" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : null}
      {!error && !loading && risks.length === 0 ? (
        <EmptyState
          title={t("risks.emptyTitle")}
          description={t("risks.emptyDescription")}
          action={createAction}
        />
      ) : null}
      {risks.length > 0 ? (
        <div className="relative" aria-busy={loading}>
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/70 pt-10">
              <Spinner label={t("common.loading")} />
            </div>
          ) : null}
          <RiskTable tenantSlug={tenantSlug} risks={risks} />
        </div>
      ) : null}
      {nextCursor ? (
        <Button type="button" variant="outline" loading={loadingMore} onClick={() => void load(false, nextCursor)}>
          {t("common.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
