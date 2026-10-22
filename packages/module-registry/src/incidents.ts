import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";

export type IncidentListResult = {
  incidents: [];
};

export async function listIncidents(
  access: TenantAccess,
): Promise<IncidentListResult | "forbidden" | "module_disabled"> {
  if (!hasEnabledModule(access, "incidents")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  return { incidents: [] };
}
