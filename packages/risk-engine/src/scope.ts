import type { TenantAccess } from "@riskflow/auth";
import type { Prisma } from "@riskflow/database";

export function visibleOrgUnitFilter(access: TenantAccess): Prisma.RiskWhereInput {
  if (access.orgUnitScope === "tenant") {
    return {};
  }
  return { orgUnitId: { in: [...access.orgUnitScope] } };
}

export function inOrgUnitScope(access: TenantAccess, orgUnitId: string): boolean {
  return access.orgUnitScope === "tenant" || access.orgUnitScope.has(orgUnitId);
}
