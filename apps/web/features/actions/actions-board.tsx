"use client";

import { localeTag } from "@riskflow/shared";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, Spinner, StatusBadge, useLocale, useT } from "@riskflow/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";
import type { ActionRecord } from "@riskflow/risk-engine";

type ActionsBoardProps = {
  tenantSlug: string;
  canComplete: boolean;
  overdueOnly?: boolean;
};

function ActionCards({
  tenantSlug,
  actions,
  canComplete,
  completing,
  onComplete,
  emptyTitle,
  emptyDescription,
  testId,
  completeLabel,
  dateLocale,
}: {
  tenantSlug: string;
  actions: ActionRecord[];
  canComplete: boolean;
  completing: boolean;
  onComplete: (actionId: string) => void;
  emptyTitle: string;
  emptyDescription: string;
  testId: string;
  completeLabel: string;
  dateLocale: string;
}) {
  if (actions.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <ul className="space-y-3" data-testid={testId}>
      {actions.map((action) => (
        <li key={action.id} className="rounded-lg border bg-card p-4" data-testid={`${testId}-item`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link className="font-medium underline-offset-4 hover:underline" href={`/t/${tenantSlug}/risks/${action.riskId}`}>
                {action.riskCode} · {action.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                {action.assignee.displayName} · {new Date(action.dueAt).toLocaleString(dateLocale)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={action.status} />
              {action.overdue ? <StatusBadge status="overdue" /> : null}
              {canComplete && action.status !== "completed" ? (
                <Button type="button" size="sm" loading={completing} onClick={() => onComplete(action.id)}>
                  {completeLabel}
                </Button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ActionsBoard({ tenantSlug, canComplete, overdueOnly = false }: ActionsBoardProps) {
  const t = useT();
  const locale = useLocale();
  const apiError = useApiError();
  const [mine, setMine] = useState<ActionRecord[]>([]);
  const [all, setAll] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const allQuery = overdueOnly ? "?overdue=true" : "";
    const [mineResult, allResult] = await Promise.all([
      apiRequest<{ actions: ActionRecord[] }>(`/api/v1/tenants/${tenantSlug}/actions?mine=true${overdueOnly ? "&overdue=true" : ""}`),
      apiRequest<{ actions: ActionRecord[] }>(`/api/v1/tenants/${tenantSlug}/actions${allQuery}`),
    ]);
    setLoading(false);
    if (!mineResult.ok) {
      setError(apiError(mineResult));
      return;
    }
    if (!allResult.ok) {
      setError(apiError(allResult));
      return;
    }
    setMine(mineResult.data.actions);
    setAll(allResult.data.actions);
  }

  useEffect(() => {
    void load();
  }, [tenantSlug, overdueOnly]);

  async function complete(actionId: string) {
    setCompleting(true);
    const result = await apiRequest<{ action: ActionRecord }>(`/api/v1/tenants/${tenantSlug}/actions/${actionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    setCompleting(false);
    if (result.ok) {
      await load();
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("actions.title")}
        description={overdueOnly ? t("actions.overdueDescription") : t("actions.description")}
      />
      {error ? <ErrorState title={t("actions.loadError")} description={error} onRetry={() => void load()} /> : null}
      {loading ? (
        <div className="space-y-2">
          <Spinner label={t("common.loading")} className="justify-start py-2" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}
      {!loading && !error ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("actions.mine")}</h2>
            <ActionCards
              tenantSlug={tenantSlug}
              actions={mine}
              canComplete={canComplete}
              completing={completing}
              onComplete={(id) => void complete(id)}
              emptyTitle={t("actions.emptyMineTitle")}
              emptyDescription={t("actions.emptyMineDescription")}
              testId="my-tasks"
              completeLabel={t("actions.complete")}
              dateLocale={localeTag(locale)}
            />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("actions.all")}</h2>
            <ActionCards
              tenantSlug={tenantSlug}
              actions={all}
              canComplete={canComplete}
              completing={completing}
              onComplete={(id) => void complete(id)}
              emptyTitle={t("actions.emptyAllTitle")}
              emptyDescription={t("actions.emptyAllDescription")}
              testId="action-list"
              completeLabel={t("actions.complete")}
              dateLocale={localeTag(locale)}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
