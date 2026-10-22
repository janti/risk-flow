"use client";

import { Button, ErrorState, PageHeader, Skeleton, Spinner, useT } from "@riskflow/ui";
import { permissionMessageKey } from "@riskflow/shared";
import type { RoleMatrixRecord } from "@riskflow/auth";
import type { PermissionKey } from "@riskflow/permissions";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";

export function RolePermissionMatrix({ tenantSlug }: { tenantSlug: string }) {
  const t = useT();
  const apiError = useApiError();
  const [roles, setRoles] = useState<RoleMatrixRecord[] | null>(null);
  const [permissionKeys, setPermissionKeys] = useState<PermissionKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const permissionLabel = (key: PermissionKey) => {
    const messageKey = permissionMessageKey(key);
    return messageKey ? t(messageKey) : key;
  };

  const load = useCallback(async () => {
    const result = await apiRequest<{ roles: RoleMatrixRecord[]; permissionKeys: PermissionKey[] }>(
      `/api/v1/tenants/${tenantSlug}/roles`,
    );
    if (!result.ok) {
      setError(apiError(result));
      return;
    }
    setRoles(result.data.roles);
    setPermissionKeys(result.data.permissionKeys);
  }, [apiError, tenantSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(roleId: string, key: PermissionKey, checked: boolean) {
    setRoles((current) =>
      current?.map((role) => {
        if (role.id !== roleId) {
          return role;
        }
        const next = checked
          ? [...new Set([...role.permissionKeys, key])]
          : role.permissionKeys.filter((item) => item !== key);
        return { ...role, permissionKeys: next };
      }) ?? null,
    );
  }

  async function onSave() {
    if (!roles) {
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await apiRequest<{ roles: RoleMatrixRecord[] }>(`/api/v1/tenants/${tenantSlug}/roles`, {
      method: "PATCH",
      body: JSON.stringify({
        roles: roles.map((role) => ({ roleId: role.id, permissionKeys: role.permissionKeys })),
      }),
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setRoles(result.data.roles);
  }

  if (error) {
    return <ErrorState title={t("roles.loadError")} description={error} />;
  }
  if (!roles) {
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
      <PageHeader
        title={t("roles.title")}
        description={t("roles.description")}
        actions={
          <Button type="button" onClick={() => void onSave()} loading={saving} data-testid="roles-save">
            {t("common.save")}
          </Button>
        }
      />
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm" data-testid="role-matrix">
          <caption className="sr-only">{t("roles.title")}</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-3">{t("roles.role")}</th>
              {permissionKeys.map((key) => (
                <th key={key} scope="col" className="px-2 py-2 font-normal">
                  {permissionLabel(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b" data-testid={`role-row-${role.key}`}>
                <th scope="row" className="py-2 pr-3 text-left font-medium">{role.label}</th>
                {permissionKeys.map((key) => (
                  <td key={key} className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={role.permissionKeys.includes(key)}
                      onChange={(event) => toggle(role.id, key, event.target.checked)}
                      aria-label={`${role.label} ${permissionLabel(key)}`}
                      data-testid={`role-perm-${role.key}-${key}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
