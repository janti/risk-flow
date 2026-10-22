"use client";

import { Badge, Button, ErrorState, PageHeader, Skeleton, Spinner, useT } from "@riskflow/ui";
import { moduleMessageKey } from "@riskflow/shared";
import type { ModuleRecord } from "@riskflow/module-registry";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";

export function ModuleToggleList({ tenantSlug }: { tenantSlug: string }) {
  const t = useT();
  const apiError = useApiError();
  const [modules, setModules] = useState<ModuleRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await apiRequest<{ modules: ModuleRecord[] }>(`/api/v1/tenants/${tenantSlug}/modules`);
    if (!result.ok) {
      setError(apiError(result));
      return;
    }
    setModules(result.data.modules);
  }, [apiError, tenantSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(module: ModuleRecord, enabled: boolean) {
    setSaving(module.key);
    setMessage(null);
    const result = await apiRequest<{ modules: ModuleRecord[] }>(`/api/v1/tenants/${tenantSlug}/modules`, {
      method: "PATCH",
      body: JSON.stringify({ modules: [{ key: module.key, enabled }] }),
    });
    setSaving(null);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setModules(result.data.modules);
  }

  if (error) {
    return <ErrorState title={t("module.loadError")} description={error} />;
  }
  if (!modules) {
    return (
      <div className="space-y-3">
        <Spinner label={t("common.loading")} className="justify-start py-2" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("module.title")} description={t("module.description")} />
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <ul className="divide-y rounded-lg border" data-testid="module-list">
        {modules.map((module) => {
          const labelKey = moduleMessageKey(module.key);
          return (
            <li key={module.key} className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid={`module-row-${module.key}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{labelKey ? t(labelKey) : module.label}</p>
                  <Badge variant={module.entitled ? "secondary" : "outline"}>
                    {module.entitled ? t("module.entitled") : t("module.notEntitled")}
                  </Badge>
                  <Badge variant={module.enabled ? "default" : "outline"}>
                    {module.enabled ? t("module.enabled") : t("module.disabled")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {module.key} · v{module.version}
                  {module.dependencies.length > 0 ? ` · ${t("module.dependsOn", { deps: module.dependencies.join(", ") })}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant={module.enabled ? "outline" : "default"}
                disabled={!module.entitled}
                loading={saving === module.key}
                onClick={() => void toggle(module, !module.enabled)}
                data-testid={`module-toggle-${module.key}`}
              >
                {module.enabled ? t("module.disable") : t("module.enable")}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
