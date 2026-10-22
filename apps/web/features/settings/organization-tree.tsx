"use client";

import { Button, ErrorState, PageHeader, Skeleton, Spinner, useT } from "@riskflow/ui";
import type { OrgUnitRecord, TenantSettingsRecord } from "@riskflow/auth";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";

function UnitNode({
  unit,
  depth,
  onAdd,
}: {
  unit: OrgUnitRecord;
  depth: number;
  onAdd: (parentId: string) => void;
}) {
  const t = useT();
  return (
    <li data-testid={`org-unit-${unit.id}`}>
      <div className="flex flex-wrap items-center gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
        <span className="font-medium">{unit.name}</span>
        <span className="text-xs text-muted-foreground">{unit.type}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => onAdd(unit.id)} data-testid={`org-add-${unit.id}`}>
          {t("org.addChild")}
        </Button>
      </div>
      {unit.children.length > 0 ? (
        <ul>
          {unit.children.map((child) => (
            <UnitNode key={child.id} unit={child} depth={depth + 1} onAdd={onAdd} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrganizationSettings({ tenantSlug }: { tenantSlug: string }) {
  const t = useT();
  const apiError = useApiError();
  const [units, setUnits] = useState<OrgUnitRecord[] | null>(null);
  const [settings, setSettings] = useState<TenantSettingsRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("fi");
  const [timezone, setTimezone] = useState("Europe/Helsinki");
  const [productName, setProductName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [saving, setSaving] = useState<"unit" | "settings" | null>(null);

  const load = useCallback(async () => {
    const [orgResult, settingsResult] = await Promise.all([
      apiRequest<{ orgUnits: OrgUnitRecord[] }>(`/api/v1/tenants/${tenantSlug}/org-units`),
      apiRequest<{ settings: TenantSettingsRecord }>(`/api/v1/tenants/${tenantSlug}/settings`),
    ]);
    if (!orgResult.ok) {
      setError(apiError(orgResult));
      return;
    }
    if (!settingsResult.ok) {
      setError(apiError(settingsResult));
      return;
    }
    setUnits(orgResult.data.orgUnits);
    setSettings(settingsResult.data.settings);
    setLocale(settingsResult.data.settings.locale);
    setTimezone(settingsResult.data.settings.timezone);
    setProductName(settingsResult.data.settings.branding.productName ?? "");
    setPrimaryColor(settingsResult.data.settings.branding.primaryColor ?? "#2563eb");
  }, [apiError, tenantSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving("unit");
    const result = await apiRequest<{ orgUnits: OrgUnitRecord[] }>(`/api/v1/tenants/${tenantSlug}/org-units`, {
      method: "POST",
      body: JSON.stringify({ name, type: "team", parentId }),
    });
    setSaving(null);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setUnits(result.data.orgUnits);
    setName("");
    setParentId(null);
  }

  async function onSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving("settings");
    const result = await apiRequest<{ settings: TenantSettingsRecord }>(`/api/v1/tenants/${tenantSlug}/settings`, {
      method: "PATCH",
      body: JSON.stringify({
        locale,
        timezone,
        branding: { productName: productName || null, primaryColor },
      }),
    });
    setSaving(null);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setSettings(result.data.settings);
  }

  if (error) {
    return <ErrorState title={t("org.loadError")} description={error} />;
  }
  if (!units || !settings) {
    return (
      <div className="space-y-3">
        <Spinner label={t("common.loading")} className="justify-start py-2" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t("org.title")} description={t("org.description")} />
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("org.tree")}</h2>
        <ul className="rounded-lg border p-3" data-testid="org-tree">
          {units.map((unit) => (
            <UnitNode key={unit.id} unit={unit} depth={0} onAdd={(id) => setParentId(id)} />
          ))}
        </ul>
        <form className="flex max-w-xl flex-wrap items-end gap-2" onSubmit={onCreate}>
          <label className="text-sm">
            {t("org.newUnit")}
            <input
              className="mt-1 block w-56 rounded-md border bg-background px-3 py-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              data-testid="org-unit-name"
            />
          </label>
          <Button type="submit" loading={saving === "unit"} data-testid="org-unit-create">
            {parentId ? t("org.addUnderSelected") : t("org.addToRoot")}
          </Button>
        </form>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("org.localeBranding")}</h2>
        <form className="grid max-w-xl gap-3" onSubmit={onSaveSettings} data-testid="tenant-settings-form">
          <label className="text-sm">
            {t("org.tenantLocale")}
            <select
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              data-testid="tenant-locale"
            >
              <option value="fi">{t("locale.fi")}</option>
              <option value="sv">{t("locale.sv")}</option>
              <option value="en">{t("locale.en")}</option>
            </select>
          </label>
          <label className="text-sm">
            {t("org.timezone")}
            <input
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              data-testid="tenant-timezone"
            />
          </label>
          <label className="text-sm">
            {t("org.productName")}
            <input
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              data-testid="tenant-product-name"
            />
          </label>
          <label className="text-sm">
            {t("org.primaryColor")}
            <input
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              data-testid="tenant-primary-color"
            />
          </label>
          <Button type="submit" loading={saving === "settings"} data-testid="tenant-settings-save">
            {t("org.saveSettings")}
          </Button>
        </form>
      </section>
    </div>
  );
}
