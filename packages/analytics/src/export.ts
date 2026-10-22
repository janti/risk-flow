import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { TenantDatabase } from "@riskflow/database";
import { listRisks, type RiskListQuery } from "@riskflow/risk-engine";
import { toCsv } from "./csv";

export async function exportRisksCsv(
  db: TenantDatabase,
  access: TenantAccess,
  query: Omit<RiskListQuery, "cursor" | "limit"> & { limit?: number },
): Promise<string | "forbidden" | "module_disabled"> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }

  const rows: string[][] = [];
  let cursor: string | undefined;
  do {
    const page = await listRisks(db, access, {
      ...query,
      cursor,
      limit: 100,
      sort: query.sort ?? "createdAt",
    });
    if (page === "forbidden" || page === "module_disabled") {
      return page;
    }
    for (const risk of page.items) {
      rows.push([
        risk.code,
        risk.title,
        risk.status,
        risk.category.code,
        risk.orgUnit.name,
        risk.owner.displayName,
        risk.latestInherent ? String(risk.latestInherent.score) : "",
        risk.latestResidual ? String(risk.latestResidual.score) : "",
        risk.createdAt,
      ]);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return toCsv(
    ["code", "title", "status", "category", "orgUnit", "owner", "inherentScore", "residualScore", "createdAt"],
    rows,
  );
}
