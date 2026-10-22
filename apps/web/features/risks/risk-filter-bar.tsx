"use client";

import { Button, useT } from "@riskflow/ui";
import type { FormEvent } from "react";
import type { RiskLookups } from "./types";

export type RiskFilters = {
  q: string;
  status: string;
  categoryId: string;
  orgUnitId: string;
  ownerId: string;
  assessmentType: "inherent" | "residual";
  likelihood: string;
  impact: string;
  createdFrom: string;
  createdTo: string;
};

type RiskFilterBarProps = {
  filters: RiskFilters;
  lookups: RiskLookups | null;
  onChange: (filters: RiskFilters) => void;
  onSubmit: () => void;
};

export function RiskFilterBar({ filters, lookups, onChange, onSubmit }: RiskFilterBarProps) {
  const t = useT();
  const invalidRange = Boolean(filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidRange) {
      return;
    }
    onSubmit();
  }

  return (
    <form
      className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-4"
      onSubmit={handleSubmit}
    >
      <label className="block text-sm xl:col-span-2">
        {t("risks.search")}
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          name="q"
          value={filters.q}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
          placeholder={t("risks.searchPlaceholder")}
          data-testid="risk-search"
        />
      </label>
      <label className="block text-sm">
        {t("common.status")}
        <select
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          name="status"
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value })}
        >
          <option value="">{t("status.openOnly")}</option>
          <option value="open">{t("status.open")}</option>
          <option value="in_progress">{t("status.in_progress")}</option>
          <option value="archived">{t("status.archived")}</option>
        </select>
      </label>
      <label className="block text-sm">
        {t("risks.category")}
        <select
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          name="categoryId"
          value={filters.categoryId}
          onChange={(event) => onChange({ ...filters, categoryId: event.target.value })}
        >
          <option value="">{t("common.all")}</option>
          {lookups?.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        {t("risks.orgUnit")}
        <select
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          name="orgUnitId"
          value={filters.orgUnitId}
          onChange={(event) => onChange({ ...filters, orgUnitId: event.target.value })}
        >
          <option value="">{t("common.all")}</option>
          {lookups?.orgUnits.map((unit) => (
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
          value={filters.ownerId}
          onChange={(event) => onChange({ ...filters, ownerId: event.target.value })}
        >
          <option value="">{t("common.all")}</option>
          {lookups?.owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        {t("risks.createdFrom")}
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          type="date"
          name="createdFrom"
          value={filters.createdFrom}
          max={filters.createdTo || undefined}
          aria-invalid={invalidRange || undefined}
          onChange={(event) => onChange({ ...filters, createdFrom: event.target.value })}
        />
      </label>
      <label className="block text-sm">
        {t("risks.createdTo")}
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          type="date"
          name="createdTo"
          value={filters.createdTo}
          min={filters.createdFrom || undefined}
          aria-invalid={invalidRange || undefined}
          onChange={(event) => onChange({ ...filters, createdTo: event.target.value })}
        />
      </label>
      <div className="flex flex-col justify-end gap-2">
        {invalidRange ? (
          <p className="text-sm text-destructive" role="alert">
            {t("common.dateRangeInvalid")}
          </p>
        ) : null}
        <Button type="submit" disabled={invalidRange} data-testid="risk-filter-submit">
          {t("common.filter")}
        </Button>
      </div>
    </form>
  );
}
