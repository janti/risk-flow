"use client";

import { Button, EmptyState, ErrorState, KpiCard, PageHeader, Skeleton, Spinner, useT } from "@riskflow/ui";
import type { MessageKey } from "@riskflow/shared";
import type { AnalyticsOverview } from "@riskflow/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";
import { RiskMatrix } from "../risks/risk-matrix";
import { DashboardFilterBar, type DashboardFilters } from "./dashboard-filter-bar";

type AnalyticsBoardProps = {
  tenantSlug: string;
  variant: "home" | "full";
  title?: string;
  description?: string;
};

function monthEnd(yearMonth: string): string {
  const [yearRaw, monthRaw] = yearMonth.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
}

function monthStart(yearMonth: string): string {
  return `${yearMonth}-01`;
}

export function AnalyticsBoard({ tenantSlug, variant, title, description }: AnalyticsBoardProps) {
  const t = useT();
  const apiError = useApiError();
  const router = useRouter();
  const heading = title ?? t("analytics.title");
  const summary = description ?? t("analytics.description");
  const initial = useMemo(() => {
    const now = new Date();
    const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    return {
      from: fromDate.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
      assessmentType: "residual" as const,
    };
  }, []);
  const [filters, setFilters] = useState<DashboardFilters>(initial);
  const [applied, setApplied] = useState<DashboardFilters>(initial);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      from: applied.from,
      to: applied.to,
      assessmentType: applied.assessmentType,
    });
    const result = await apiRequest<{ overview: AnalyticsOverview }>(
      `/api/v1/tenants/${tenantSlug}/analytics/overview?${params.toString()}`,
    );
    setLoading(false);
    if (!result.ok) {
      setError(apiError(result));
      return;
    }
    setOverview(result.data.overview);
  }, [apiError, applied, tenantSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const riskHref = (extra: Record<string, string>) => {
    const params = new URLSearchParams({
      createdFrom: applied.from,
      createdTo: applied.to,
      ...extra,
    });
    return `/t/${tenantSlug}/risks?${params.toString()}`;
  };

  const exportQuery = `createdFrom=${applied.from}&createdTo=${applied.to}`;
  const exportHref = `/api/v1/tenants/${tenantSlug}/exports/risks.csv?${exportQuery}`;
  const exportPdfHref = `/api/v1/tenants/${tenantSlug}/exports/risks.pdf?${exportQuery}`;
  const maxTrend = Math.max(1, ...(overview?.monthlyTrends.map((item) => Math.max(item.created, item.assessed)) ?? [1]));

  return (
    <div className="space-y-6" data-testid={variant === "home" ? "role-dashboard" : "analytics-dashboard"}>
      <PageHeader
        title={heading}
        description={summary}
        actions={
          variant === "full" ? (
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <a href={exportHref} data-testid="export-risks">
                  {t("analytics.exportCsv")}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={exportPdfHref} data-testid="export-risks-pdf">
                  {t("analytics.exportPdf")}
                </a>
              </Button>
            </div>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/t/${tenantSlug}/analytics`}>{t("analytics.open")}</Link>
            </Button>
          )
        }
      />
      {overview ? (
        <p className="text-sm text-muted-foreground" data-testid="dashboard-audience">
          {t(`analytics.audience.${overview.audience}` as MessageKey)}.{" "}
          {t("analytics.window", { from: overview.window.from, to: overview.window.to })}
        </p>
      ) : null}
      {variant === "full" ? (
        <DashboardFilterBar
          filters={filters}
          onChange={setFilters}
          onSubmit={() => setApplied(filters)}
          loading={loading}
        />
      ) : null}
      {error ? <ErrorState title={t("analytics.loadError")} description={error} onRetry={() => void load()} /> : null}
      {loading && !overview ? (
        <div className="space-y-4">
          <Spinner label={t("common.loading")} className="py-4" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ) : null}
      {overview ? (
        <div className="relative space-y-6" aria-busy={loading}>
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/70 pt-16">
              <Spinner label={t("common.loading")} />
            </div>
          ) : null}
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" data-testid="kpi-row">
            <KpiCard
              label={t("analytics.openRisks")}
              value={overview.kpis.openRisks}
              testId="kpi-open-risks"
              action={
                <Link className="text-sm font-medium underline-offset-4 hover:underline" href={riskHref({ status: "open" })}>
                  {t("common.openList")}
                </Link>
              }
            />
            <KpiCard
              label={t("analytics.inProgress")}
              value={overview.kpis.inProgressRisks}
              testId="kpi-in-progress"
              action={
                <Link
                  className="text-sm font-medium underline-offset-4 hover:underline"
                  href={riskHref({ status: "in_progress" })}
                >
                  {t("common.openList")}
                </Link>
              }
            />
            <KpiCard
              label={t("analytics.highCritical")}
              value={overview.kpis.highOrCriticalRisks}
              testId="kpi-high"
              action={
                <Link className="text-sm font-medium underline-offset-4 hover:underline" href={riskHref({})}>
                  {t("analytics.openRegister")}
                </Link>
              }
            />
            <KpiCard
              label={t("analytics.overdue")}
              value={overview.kpis.overdueActions}
              testId="kpi-overdue"
              action={
                <Link
                  className="text-sm font-medium underline-offset-4 hover:underline"
                  href={`/t/${tenantSlug}/actions?overdue=true`}
                >
                  {t("analytics.openActions")}
                </Link>
              }
            />
            <KpiCard label={t("analytics.pendingTreatments")} value={overview.kpis.pendingTreatments} testId="kpi-pending" />
          </section>
          <RiskMatrix
            heatmap={overview.heatmap}
            busy={loading}
            selected={null}
            onTypeChange={(assessmentType) => {
              const next = { ...applied, assessmentType };
              setFilters(next);
              setApplied(next);
            }}
            onSelect={(cell) => {
              if (!cell) {
                router.push(riskHref({}));
                return;
              }
              router.push(
                riskHref({
                  assessmentType: applied.assessmentType,
                  likelihood: String(cell.likelihood),
                  impact: String(cell.impact),
                }),
              );
            }}
          />
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <h2 className="text-lg font-semibold">{t("analytics.categories")}</h2>
              {overview.categories.length === 0 ? (
                <EmptyState title={t("analytics.noCategoriesTitle")} description={t("analytics.noCategoriesDescription")} />
              ) : (
                <ul className="space-y-2" data-testid="category-breakdown">
                  {overview.categories.map((category) => (
                    <li key={category.categoryId}>
                      <Link
                        className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        href={riskHref({ categoryId: category.categoryId })}
                        data-testid={`category-${category.code}`}
                      >
                        <span>
                          {category.name} ({category.code})
                        </span>
                        <span className="font-medium">{category.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <h2 className="text-lg font-semibold">{t("analytics.overdueActions")}</h2>
              {overview.kpis.overdueActions > overview.overdueActions.length ? (
                <p className="text-sm text-muted-foreground">
                  {t("analytics.overduePreview", {
                    shown: overview.overdueActions.length,
                    total: overview.kpis.overdueActions,
                  })}
                </p>
              ) : null}
              {overview.overdueActions.length === 0 ? (
                <EmptyState title={t("analytics.noOverdueTitle")} description={t("analytics.noOverdueDescription")} />
              ) : (
                <ul className="space-y-2" data-testid="overdue-actions">
                  {overview.overdueActions.map((action) => (
                    <li key={action.id}>
                      <Link
                        className="block cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        href={`/t/${tenantSlug}/risks/${action.riskId}`}
                      >
                        {action.riskCode} · {action.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          {variant === "full" ? (
            <section className="space-y-3 rounded-lg border bg-card p-4" data-testid="monthly-trends">
              <h2 className="text-lg font-semibold">{t("analytics.trend")}</h2>
              <p className="text-sm text-muted-foreground">{t("analytics.trendDescription")}</p>
              <table className="sr-only">
                <caption>{t("analytics.trendCaption")}</caption>
                <thead>
                  <tr>
                    <th>{t("analytics.month")}</th>
                    <th>{t("analytics.created")}</th>
                    <th>{t("analytics.assessed")}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.monthlyTrends.map((item) => (
                    <tr key={item.month}>
                      <td>{item.month}</td>
                      <td>{item.created}</td>
                      <td>{item.assessed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="space-y-2">
                {overview.monthlyTrends.map((item) => (
                  <li key={item.month}>
                    <Link
                      className="block cursor-pointer space-y-1 rounded-md p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      href={riskHref({ createdFrom: monthStart(item.month), createdTo: monthEnd(item.month) })}
                      data-testid={`trend-${item.month}`}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium underline-offset-4 hover:underline">{item.month}</span>
                        <span>
                          {t("analytics.trendCounts", { created: item.created, assessed: item.assessed })}
                        </span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded bg-muted" aria-hidden="true">
                        <div className="bg-primary" style={{ width: `${(item.created / maxTrend) * 100}%` }} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
