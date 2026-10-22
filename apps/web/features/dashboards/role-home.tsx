"use client";

import type { MessageKey } from "@riskflow/shared";
import { useT } from "@riskflow/ui";
import { AnalyticsBoard } from "./analytics-board";
import { EmployeeHome } from "./employee-home";

export type DashboardAudience = "employee" | "manager" | "risk-manager" | "tenant-admin";

export function dashboardAudience(roleKeys: readonly string[]): DashboardAudience {
  if (roleKeys.includes("tenant-admin")) {
    return "tenant-admin";
  }
  if (roleKeys.includes("risk-manager")) {
    return "risk-manager";
  }
  if (roleKeys.includes("manager")) {
    return "manager";
  }
  return "employee";
}

export function RoleHome({
  tenantSlug,
  displayName,
  roleKeys,
}: {
  tenantSlug: string;
  displayName: string;
  roleKeys: readonly string[];
}) {
  const t = useT();
  const audience = dashboardAudience(roleKeys);
  if (audience === "employee") {
    return <EmployeeHome tenantSlug={tenantSlug} displayName={displayName} />;
  }
  return (
    <AnalyticsBoard
      tenantSlug={tenantSlug}
      variant="home"
      title={t(`home.${audience}.title` as MessageKey)}
      description={t(`home.${audience}.description` as MessageKey)}
    />
  );
}
