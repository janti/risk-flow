"use client";

import { localeTag } from "@riskflow/shared";
import { Button, EmptyState, ErrorState, PermissionGate, Skeleton, Spinner, StatusBadge, useLocale, useT } from "@riskflow/ui";
import type { ActionRecord, RiskLookups } from "@riskflow/risk-engine";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";

type RiskActionListProps = {
  tenantSlug: string;
  riskId: string;
  canAssign: boolean;
  canComplete: boolean;
};

function defaultDueAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 16);
}

export function RiskActionList({ tenantSlug, riskId, canAssign, canComplete }: RiskActionListProps) {
  const t = useT();
  const locale = useLocale();
  const apiError = useApiError();
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [lookups, setLookups] = useState<RiskLookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeMembershipId, setAssigneeMembershipId] = useState("");
  const [dueAt, setDueAt] = useState(defaultDueAt);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const result = await apiRequest<{ actions: ActionRecord[] }>(
      `/api/v1/tenants/${tenantSlug}/risks/${riskId}/actions`,
    );
    setLoading(false);
    if (!result.ok) {
      setError(apiError(result));
      return;
    }
    setActions(result.data.actions);
  }

  useEffect(() => {
    void load();
    void apiRequest<RiskLookups>(`/api/v1/tenants/${tenantSlug}/risks/lookups`).then((result) => {
      if (result.ok) {
        setLookups(result.data);
        setAssigneeMembershipId((current) => current || result.data.owners[0]?.id || "");
      }
    });
  }, [riskId, tenantSlug]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await apiRequest<{ action: ActionRecord }>(
      `/api/v1/tenants/${tenantSlug}/risks/${riskId}/actions`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          assigneeMembershipId,
          dueAt: new Date(dueAt).toISOString(),
        }),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setTitle("");
    setDescription("");
    await load();
  }

  async function complete(actionId: string) {
    setSaving(true);
    setMessage(null);
    const result = await apiRequest<{ action: ActionRecord }>(`/api/v1/tenants/${tenantSlug}/actions/${actionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    await load();
  }

  if (error) {
    return <ErrorState title={t("actions.loadError")} description={error} onRetry={() => void load()} />;
  }
  if (loading) {
    return (
      <div className="space-y-3">
        <Spinner label={t("common.loading")} className="justify-start" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="risk-action-list">
      <h2 className="text-lg font-semibold">{t("actions.title")}</h2>
      <PermissionGate allowed={canAssign}>
        <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="block text-sm md:col-span-2">
            {t("common.title")}
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              data-testid="action-title"
            />
          </label>
          <label className="block text-sm">
            {t("actions.assignee")}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={assigneeMembershipId}
              onChange={(event) => setAssigneeMembershipId(event.target.value)}
              data-testid="action-assignee"
            >
              {(lookups?.owners ?? []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t("actions.dueAt")}
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              type="datetime-local"
              required
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              data-testid="action-due-at"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            {t("common.description")}
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {message ? (
            <p className="text-sm text-destructive md:col-span-2" role="alert">
              {message}
            </p>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" loading={saving} disabled={!assigneeMembershipId} data-testid="action-save">
              {t("actions.add")}
            </Button>
          </div>
        </form>
      </PermissionGate>
      {actions.length === 0 ? (
        <EmptyState title={t("actions.emptyRiskTitle")} description={t("actions.emptyRiskDescription")} />
      ) : (
        <ul className="space-y-3">
          {actions.map((action) => (
            <li key={action.id} className="rounded-lg border bg-card p-4" data-testid="action-item">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{action.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {action.assignee.displayName} · {new Date(action.dueAt).toLocaleString(localeTag(locale))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={action.status} />
                  {action.overdue ? <StatusBadge status="overdue" /> : null}
                  <PermissionGate allowed={canComplete && action.status !== "completed"}>
                    <Button
                      type="button"
                      size="sm"
                      loading={saving}
                      onClick={() => void complete(action.id)}
                      data-testid={`action-complete-${action.id}`}
                    >
                      {t("actions.complete")}
                    </Button>
                  </PermissionGate>
                </div>
              </div>
              {action.description ? <p className="mt-2 text-sm">{action.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
