"use client";

import { categoryGuidance } from "@riskflow/risk-engine/guidance";
import { Button, ErrorState, PageHeader, Skeleton, Spinner, useT } from "@riskflow/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { RiskFormRenderer } from "../forms/risk-form-renderer";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";
import { StandardGuidance } from "./standard-guidance";
import type { RiskLookups, RiskRecord } from "./types";

type RiskFormProps = {
  tenantSlug: string;
  mode: "create" | "edit";
  risk?: RiskRecord;
  onSaved?: (risk: RiskRecord) => void;
};

export function RiskForm({ tenantSlug, mode, risk, onSaved }: RiskFormProps) {
  const t = useT();
  const apiError = useApiError();
  const router = useRouter();
  const [lookups, setLookups] = useState<RiskLookups | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState(risk?.title ?? "");
  const [description, setDescription] = useState(risk?.description ?? "");
  const [categoryId, setCategoryId] = useState(risk?.category.id ?? "");
  const [orgUnitId, setOrgUnitId] = useState(risk?.orgUnit.id ?? "");
  const [ownerId, setOwnerId] = useState(risk?.owner.id ?? "");
  const [status, setStatus] = useState(risk?.status === "in_progress" ? "in_progress" : "open");
  const [customValues, setCustomValues] = useState<Record<string, unknown>>(risk?.customValues ?? {});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiRequest<RiskLookups>(`/api/v1/tenants/${tenantSlug}/risks/lookups`).then((result) => {
      if (!result.ok) {
        setLoadError(apiError(result));
        return;
      }
      setLookups(result.data);
      const initialCategory =
        result.data.categories.find((category) => category.id === (risk?.category.id ?? "")) ??
        result.data.categories[0];
      setCategoryId((current) => current || initialCategory?.id || "");
      setOrgUnitId((current) => current || result.data.orgUnits[0]?.id || "");
      setOwnerId((current) => current || result.data.owners[0]?.id || "");
      if (mode === "create" && initialCategory) {
        const initialTemplate = t(categoryGuidance(initialCategory.code).templateKey);
        setDescription((current) => (current.trim().length === 0 ? initialTemplate : current));
      }
    });
  }, [apiError, mode, risk?.category.id, t, tenantSlug]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload =
      mode === "create"
        ? {
            title,
            ...(description.trim().length > 0 ? { description: description.trim() } : {}),
            categoryId,
            orgUnitId,
            ownerId,
            customValues,
          }
        : {
            version: risk?.version,
            title,
            description: description.trim().length > 0 ? description.trim() : null,
            categoryId,
            orgUnitId,
            ownerId,
            status,
            customValues,
          };
    const result = await apiRequest<{ risk: RiskRecord }>(
      mode === "create"
        ? `/api/v1/tenants/${tenantSlug}/risks`
        : `/api/v1/tenants/${tenantSlug}/risks/${risk?.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    if (onSaved) {
      onSaved(result.data.risk);
    } else {
      router.push(`/t/${tenantSlug}/risks/${result.data.risk.id}`);
    }
    router.refresh();
  }

  if (loadError) {
    return <ErrorState title={t("risks.lookupsError")} description={loadError} />;
  }
  if (!lookups) {
    return (
      <div className="space-y-3">
        <Spinner label={t("common.loading")} className="justify-start py-2" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const categories = lookups.categories;
  const selectedCategory = categories.find((category) => category.id === categoryId) ?? categories[0];
  const pack = categoryGuidance(selectedCategory?.code ?? "");
  const template = t(pack.templateKey);

  function applyGuidanceTemplate() {
    setDescription(template);
  }

  function onCategoryChange(nextId: string) {
    const nextCategory = categories.find((category) => category.id === nextId);
    const nextTemplate = t(categoryGuidance(nextCategory?.code ?? "").templateKey);
    setCategoryId(nextId);
    if (description.trim().length === 0 || description === template) {
      setDescription(nextTemplate);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "create" ? t("risks.new") : t("risks.editTitle", { code: risk?.code ?? "" })}
        description={t("risks.formDescription")}
      />
      <form className="max-w-xl space-y-4 rounded-lg border bg-card p-6" onSubmit={onSubmit}>
        <label className="block text-sm">
          {t("common.title")}
          <input
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            name="title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            data-testid="risk-title"
          />
        </label>
        <label className="block text-sm">
          {t("risks.category")}
          <select
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            name="categoryId"
            required
            value={categoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
            data-testid="risk-category"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        {selectedCategory ? <StandardGuidance categoryCode={selectedCategory.code} surface="identify" /> : null}
        <div className="space-y-2">
          <label className="block text-sm">
            {t("common.description")}
            <textarea
              className="mt-1 min-h-28 w-full rounded-md border bg-background px-3 py-2"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={template}
              data-testid="risk-description"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={applyGuidanceTemplate}
            data-testid="guidance-use-template"
          >
            {t("guidance.useTemplate")}
          </Button>
        </div>
        <label className="block text-sm">
          {t("risks.orgUnitFull")}
          <select
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            name="orgUnitId"
            required
            value={orgUnitId}
            onChange={(event) => setOrgUnitId(event.target.value)}
            data-testid="risk-org-unit"
          >
            {lookups.orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          {t("risks.owner")}
          <select
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            name="ownerId"
            required
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            data-testid="risk-owner"
          >
            {lookups.owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.displayName}
              </option>
            ))}
          </select>
        </label>
        {(() => {
          const bound = mode === "edit" ? risk?.formVersion : lookups.publishedForm;
          if (!bound) {
            return null;
          }
          return (
            <RiskFormRenderer
              schema={bound.schema}
              ui={bound.ui}
              values={customValues}
              onChange={setCustomValues}
              users={lookups.owners.map((owner) => ({ id: owner.id, label: owner.displayName }))}
              orgUnits={lookups.orgUnits.map((unit) => ({ id: unit.id, label: unit.name }))}
            />
          );
        })()}
        {mode === "edit" ? (
          <label className="block text-sm">
            {t("common.status")}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="open">{t("status.open")}</option>
              <option value="in_progress">{t("status.in_progress")}</option>
            </select>
          </label>
        ) : null}
        {message ? (
          <p className="text-sm text-destructive" role="alert">
            {message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push(`/t/${tenantSlug}/risks`)}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={saving} data-testid="risk-save">
            {mode === "create" ? t("risks.create") : t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
