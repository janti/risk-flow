"use client";

import { EmptyState, ErrorState, KpiCard, PageHeader, Skeleton, Spinner, StatusBadge, useT } from "@riskflow/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ActionRecord } from "@riskflow/risk-engine";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";

type EmployeeHomeProps = {
  tenantSlug: string;
  displayName: string;
};

export function EmployeeHome({ tenantSlug, displayName }: EmployeeHomeProps) {
  const t = useT();
  const apiError = useApiError();
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<{ actions: ActionRecord[] }>(`/api/v1/tenants/${tenantSlug}/actions?mine=true`).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(apiError(result));
        return;
      }
      setActions(result.data.actions);
    });
  }, [apiError, tenantSlug]);

  const overdue = actions.filter((action) => action.overdue);
  const open = actions.filter((action) => action.status !== "completed");

  return (
    <div className="space-y-6" data-testid="employee-home">
      <PageHeader title={t("home.welcome", { name: displayName })} description={t("home.employeeDescription")} />
      {error ? <ErrorState title={t("home.loadError")} description={error} /> : null}
      {loading ? (
        <div className="space-y-3">
          <Spinner label={t("common.loading")} className="justify-start py-2" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ) : null}
      {!loading && !error ? (
        <>
          <section className="grid gap-3 md:grid-cols-2">
            <KpiCard
              label={t("home.myOpenTasks")}
              value={open.length}
              testId="kpi-my-open"
              action={
                <Link className="text-sm font-medium underline-offset-4 hover:underline" href={`/t/${tenantSlug}/actions`}>
                  {t("home.goToActions")}
                </Link>
              }
            />
            <KpiCard
              label={t("home.overdue")}
              value={overdue.length}
              testId="kpi-my-overdue"
              action={
                <Link
                  className="text-sm font-medium underline-offset-4 hover:underline"
                  href={`/t/${tenantSlug}/actions?overdue=true`}
                >
                  {t("home.showOverdue")}
                </Link>
              }
            />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("home.myTasks")}</h2>
            {actions.length === 0 ? (
              <EmptyState
                title={t("home.noAssignedTitle")}
                description={t("home.noAssignedDescription")}
                action={
                  <Link className="text-sm font-medium underline-offset-4 hover:underline" href={`/t/${tenantSlug}/risks`}>
                    {t("home.openRegister")}
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3" data-testid="employee-tasks">
                {actions.map((action) => (
                  <li key={action.id} className="rounded-lg border bg-card p-4">
                    <Link
                      className="font-medium underline-offset-4 hover:underline"
                      href={`/t/${tenantSlug}/risks/${action.riskId}`}
                    >
                      {action.riskCode} · {action.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={action.status} />
                      {action.overdue ? <StatusBadge status="overdue" /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
