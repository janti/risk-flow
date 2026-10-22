import { loadTenantAccess } from "@riskflow/auth";
import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssessment, getAssessmentHeatmap, listAssessments } from "./assessments";
import { DEFAULT_3X3_THRESHOLDS, DEFAULT_5X5_THRESHOLDS } from "./scoring";
import { listRisks } from "./register";

describe("assessments and scoring", () => {
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

  async function acmeRisk() {
    const admin = await access("acme-admin", "acme");
    const listed = await listRisks(db.app, admin, { limit: 100, sort: "createdAt" });
    if (typeof listed === "string") {
      throw new Error("list failed");
    }
    const risk = listed.items.find((item) => item.code === "R-001");
    if (!risk) {
      throw new Error("missing R-001");
    }
    const models = await listAssessments(db.app, admin, risk.id);
    if (typeof models === "string") {
      throw new Error("assessments failed");
    }
    return { admin, risk, model: models.scoringModels[0]! };
  }

  it("stores score and rating from the selected model version", async () => {
    const { risk, model } = await acmeRisk();
    const manager = await access("acme-risk-manager", "acme");
    const created = await createAssessment(db.app, manager, risk.id, {
      assessmentType: "residual",
      likelihood: 5,
      impact: 5,
      rationale: "Worst-case residual after limited controls.",
      scoringVersionId: model.id,
    });
    expect(created).toMatchObject({
      score: 25,
      rating: "critical",
      scoringModelVersion: 1,
    });
    expect(model.thresholds).toEqual(DEFAULT_5X5_THRESHOLDS);
  });

  it("forbids employees from creating assessments", async () => {
    const { risk, model } = await acmeRisk();
    const employee = await access("acme-employee", "acme");
    expect(
      await createAssessment(db.app, employee, risk.id, {
        assessmentType: "inherent",
        likelihood: 2,
        impact: 2,
        rationale: "Should not persist",
        scoringVersionId: model.id,
      }),
    ).toBe("forbidden");
  });

  it("hides the other tenant's assessments", async () => {
    const { risk } = await acmeRisk();
    const globex = await access("globex-admin", "globex");
    expect(await listAssessments(db.app, globex, risk.id)).toBe("not_found");
  });

  it("keeps historical ratings after a new model version", async () => {
    const { admin, risk, model } = await acmeRisk();
    const original = await listAssessments(db.app, admin, risk.id);
    if (typeof original === "string") {
      throw new Error("list failed");
    }
    const seeded = original.assessments.find((item) => item.assessmentType === "inherent");
    expect(seeded).toMatchObject({ score: 16, rating: "high", scoringModelVersion: 1 });

    await db.app.withTenant(admin.tenant.id, (tx) =>
      tx.scoringModel.create({
        data: {
          tenantId: admin.tenant.id,
          key: "default",
          version: 99,
          publishedAt: new Date(),
          definitionJson: {
            grid: "5x5",
            thresholds: { lowMax: 25, mediumMax: 25, highMax: 25 },
          },
        },
      }),
    );

    const after = await listAssessments(db.app, admin, risk.id);
    if (typeof after === "string") {
      throw new Error("list failed");
    }
    const historical = after.assessments.find((item) => item.id === seeded?.id);
    expect(historical).toMatchObject({ score: 16, rating: "high", scoringModelVersion: 1 });
    expect(model.id).toBe(historical?.scoringVersionId);
  });

  it("rejects likelihood outside a 3x3 grid", async () => {
    const { admin, risk } = await acmeRisk();
    const threeByThree = await db.app.withTenant(admin.tenant.id, (tx) =>
      tx.scoringModel.create({
        data: {
          tenantId: admin.tenant.id,
          key: "compact",
          version: 1,
          publishedAt: new Date(),
          definitionJson: { grid: "3x3", thresholds: DEFAULT_3X3_THRESHOLDS },
        },
      }),
    );
    const manager = await access("acme-risk-manager", "acme");
    expect(
      await createAssessment(db.app, manager, risk.id, {
        assessmentType: "inherent",
        likelihood: 4,
        impact: 1,
        rationale: "Out of range",
        scoringVersionId: threeByThree.id,
      }),
    ).toBe("invalid");
  });

  it("counts heatmap cells from authorized risks only", async () => {
    const admin = await access("acme-admin", "acme");
    const manager = await access("acme-manager", "acme");
    const adminHeat = await getAssessmentHeatmap(db.app, admin, "inherent");
    const managerHeat = await getAssessmentHeatmap(db.app, manager, "inherent");
    if (typeof adminHeat === "string" || typeof managerHeat === "string") {
      throw new Error("heatmap failed");
    }
    const adminCell = adminHeat.cells.find((cell) => cell.likelihood === 4 && cell.impact === 4);
    const managerHqCell = managerHeat.cells.find((cell) => cell.likelihood === 4 && cell.impact === 4);
    const managerOpsCell = managerHeat.cells.find((cell) => cell.likelihood === 3 && cell.impact === 2);
    expect(adminCell?.count).toBeGreaterThanOrEqual(1);
    expect(adminHeat.total).toBe(adminHeat.cells.reduce((sum, cell) => sum + cell.count, 0));
    expect(adminHeat.total).toBeGreaterThan(managerHeat.total);
    expect(managerHqCell?.count ?? 0).toBe(0);
    expect(managerOpsCell?.count).toBeGreaterThanOrEqual(1);
    expect(managerHeat.total).toBe(managerHeat.cells.reduce((sum, cell) => sum + cell.count, 0));
  });
});
