"use client";

import { Button, useT } from "@riskflow/ui";
import type { FormEvent } from "react";

export type DashboardFilters = {
  from: string;
  to: string;
  assessmentType: "inherent" | "residual";
};

type DashboardFilterBarProps = {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onSubmit: () => void;
  loading?: boolean;
};

export function DashboardFilterBar({ filters, onChange, onSubmit, loading = false }: DashboardFilterBarProps) {
  const t = useT();
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidRange) {
      return;
    }
    onSubmit();
  }

  return (
    <form
      className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4"
      onSubmit={handleSubmit}
      data-testid="dashboard-filter-bar"
    >
      <label className="block text-sm">
        {t("analytics.from")}
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          type="date"
          name="from"
          value={filters.from}
          max={filters.to || undefined}
          aria-invalid={invalidRange || undefined}
          onChange={(event) => onChange({ ...filters, from: event.target.value })}
        />
      </label>
      <label className="block text-sm">
        {t("analytics.to")}
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          type="date"
          name="to"
          value={filters.to}
          min={filters.from || undefined}
          aria-invalid={invalidRange || undefined}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
      </label>
      <label className="block text-sm">
        {t("analytics.assessment")}
        <select
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          name="assessmentType"
          value={filters.assessmentType}
          onChange={(event) =>
            onChange({ ...filters, assessmentType: event.target.value as DashboardFilters["assessmentType"] })
          }
        >
          <option value="residual">{t("risks.residual")}</option>
          <option value="inherent">{t("risks.inherent")}</option>
        </select>
      </label>
      <div className="flex flex-col justify-end gap-2">
        {invalidRange ? (
          <p className="text-sm text-destructive" role="alert">
            {t("common.dateRangeInvalid")}
          </p>
        ) : null}
        <Button type="submit" loading={loading} disabled={invalidRange}>
          {t("common.update")}
        </Button>
      </div>
    </form>
  );
}
