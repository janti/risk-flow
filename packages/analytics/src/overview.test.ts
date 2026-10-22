import { loadTenantAccess } from "@riskflow/auth";
import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { listActions, listRisks } from "@riskflow/risk-engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportRisksCsv } from "./export";
import { exportRisksPdf } from "./pdf";
import { getAnalyticsOverview } from "./overview";
import { defaultAnalyticsWindow } from "./window";

describe("authorized analytics overview", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 300_000);

  afterAll(async () => {
    await db?.stop();
  });

  async function access(accountId: string, tenantSlug: string) {
    const loaded = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject(accountId),
      tenantSlug,
    });
    if (!loaded) {
      throw new Error(`missing access ${accountId}/${tenantSlug}`);
    }
    return loaded;
  }

  it("forbids employees from reading aggregates", async () => {
    const employee = await access("acme-employee", "acme");
    expect(await getAnalyticsOverview(db.app, employee, { assessmentType: "residual" })).toBe("forbidden");
  });

  it("reconciles admin KPIs, heatmap and categories with permitted records", async () => {
    const admin = await access("acme-admin", "acme");
    const window = defaultAnalyticsWindow();
    const overview = await getAnalyticsOverview(db.app, admin, {
      assessmentType: "residual",
      from: window.fromDate,
      to: window.toDate,
    });
    if (typeof overview === "string") {
      throw new Error("overview failed");
    }

    const listed = await listRisks(db.app, admin, {
      limit: 100,
      sort: "createdAt",
      createdFrom: window.fromDate,
      createdTo: window.toDate,
    });
    if (typeof listed === "string") {
      throw new Error("list failed");
    }
    const overdue = await listActions(db.app, admin, { limit: 100, mine: false, overdue: true });
    if (typeof overdue === "string") {
      throw new Error("actions failed");
    }

    expect(overview.kpis.openRisks + overview.kpis.inProgressRisks).toBe(listed.items.length);
    expect(overview.kpis.openRisks + overview.kpis.inProgressRisks).toBe(
      overview.monthlyTrends.reduce((sum, month) => sum + month.created, 0),
    );
    expect(overview.heatmap.total).toBe(overview.heatmap.cells.reduce((sum, cell) => sum + cell.count, 0));
    expect(overview.categories.reduce((sum, category) => sum + category.count, 0)).toBe(listed.items.length);
    expect(overview.kpis.overdueActions).toBe(overdue.items.length);
    expect(overview.overdueActions.length).toBeLessThanOrEqual(25);
    expect(overview.overdueActions.length).toBe(Math.min(overview.kpis.overdueActions, 25));
    expect(overview.kpis.pendingTreatments).toBeGreaterThanOrEqual(1);
  });

  it("scopes manager aggregates to Operations records", async () => {
    const admin = await access("acme-admin", "acme");
    const manager = await access("acme-manager", "acme");
    const adminOverview = await getAnalyticsOverview(db.app, admin, { assessmentType: "residual" });
    const managerOverview = await getAnalyticsOverview(db.app, manager, { assessmentType: "residual" });
    if (typeof adminOverview === "string" || typeof managerOverview === "string") {
      throw new Error("overview failed");
    }

    const managerRisks = await listRisks(db.app, manager, { limit: 100, sort: "createdAt" });
    if (typeof managerRisks === "string") {
      throw new Error("list failed");
    }

    expect(managerOverview.kpis.openRisks + managerOverview.kpis.inProgressRisks).toBe(managerRisks.items.length);
    expect(managerOverview.kpis.openRisks).toBeLessThan(adminOverview.kpis.openRisks);
    expect(managerOverview.heatmap.total).toBeLessThan(adminOverview.heatmap.total);
    expect(managerRisks.items.every((risk) => risk.orgUnit.name === "Operations")).toBe(true);
    expect(managerOverview.overdueActions.every((action) => action.riskCode === "OPS-001")).toBe(true);
  });

  it("hides acme aggregates from globex and exports only permitted rows", async () => {
    const globex = await access("globex-admin", "globex");
    const acme = await access("acme-admin", "acme");
    const globexOverview = await getAnalyticsOverview(db.app, globex, { assessmentType: "residual" });
    if (typeof globexOverview === "string") {
      throw new Error("globex overview failed");
    }
    expect(globexOverview.overdueActions.some((action) => action.riskCode === "R-001")).toBe(true);

    const acmeExport = await exportRisksCsv(db.app, acme, { sort: "code" });
    const globexExport = await exportRisksCsv(db.app, globex, { sort: "code" });
    expect(typeof acmeExport).toBe("string");
    expect(typeof globexExport).toBe("string");
    expect(acmeExport).toContain("Single-source supplier outage");
    expect(globexExport).not.toContain("Single-source supplier outage");
    expect(globexExport).toContain("Unencrypted backup media");

    const acmePdf = await exportRisksPdf(db.app, acme, { sort: "code" });
    const globexPdf = await exportRisksPdf(db.app, globex, { sort: "code" });
    expect(acmePdf).toBeInstanceOf(Uint8Array);
    expect(globexPdf).toBeInstanceOf(Uint8Array);
    const acmeText = Buffer.from(acmePdf as Uint8Array).toString("latin1");
    const globexText = Buffer.from(globexPdf as Uint8Array).toString("latin1");
    expect(acmeText).toContain("Single-source supplier outage");
    expect(globexText).not.toContain("Single-source supplier outage");
    expect(globexText).toContain("Unencrypted backup media");
  });
});
