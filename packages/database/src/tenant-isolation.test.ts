import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratorClient } from "./tenant-database";
import { startTestDatabase, type TestDatabase } from "./test-postgres";

describe("tenant isolation", () => {
  let db: TestDatabase;
  let acmeId: string;
  let globexId: string;
  let acmeOrgUnitId: string;
  let acmeMembershipId: string;
  let globexCategoryId: string;
  let globexOrgUnitId: string;
  let globexMembershipId: string;
  let acmeRiskId: string;
  let globexRiskId: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    const migrator = createMigratorClient(db.ownerUrl);
    try {
      const acme = await migrator.tenant.findUniqueOrThrow({ where: { slug: "acme" } });
      const globex = await migrator.tenant.findUniqueOrThrow({ where: { slug: "globex" } });
      acmeId = acme.id;
      globexId = globex.id;

      const acmeRisk = await migrator.risk.findUniqueOrThrow({
        where: { tenantId_code: { tenantId: acmeId, code: "R-001" } },
      });
      const globexRisk = await migrator.risk.findUniqueOrThrow({
        where: { tenantId_code: { tenantId: globexId, code: "R-001" } },
      });
      acmeRiskId = acmeRisk.id;
      globexRiskId = globexRisk.id;
      acmeOrgUnitId = acmeRisk.orgUnitId;
      acmeMembershipId = acmeRisk.ownerMembershipId;
      globexCategoryId = globexRisk.categoryId;
      globexOrgUnitId = globexRisk.orgUnitId;
      globexMembershipId = globexRisk.ownerMembershipId;
    } finally {
      await migrator.$disconnect();
    }
  }, 300_000);

  afterAll(async () => {
    await db?.stop();
  });

  it("rejects invalid tenant ids before touching the database", async () => {
    await expect(db.app.withTenant("acme", async () => null)).rejects.toThrow("Invalid tenant id");
  });

  it("lets a tenant read only its own risks", async () => {
    const acmeRisks = await db.app.withTenant(acmeId, (tx) => tx.risk.findMany());
    const globexRisks = await db.app.withTenant(globexId, (tx) => tx.risk.findMany());

    expect(acmeRisks.map((risk) => risk.id)).toContain(acmeRiskId);
    expect(globexRisks.map((risk) => risk.id)).toContain(globexRiskId);
    expect(acmeRisks.every((risk) => risk.tenantId === acmeId)).toBe(true);
    expect(globexRisks.every((risk) => risk.tenantId === globexId)).toBe(true);
    expect(acmeRisks.some((risk) => risk.id === globexRiskId)).toBe(false);
  });

  it("hides the other tenant on SELECT by id", async () => {
    const leaked = await db.app.withTenant(globexId, (tx) =>
      tx.risk.findUnique({ where: { id: acmeRiskId } }),
    );
    expect(leaked).toBeNull();
  });

  it("does not UPDATE another tenant's risk", async () => {
    const result = await db.app.withTenant(globexId, (tx) =>
      tx.risk.updateMany({
        where: { id: acmeRiskId },
        data: { title: "cross-tenant overwrite" },
      }),
    );
    expect(result.count).toBe(0);

    const original = await db.app.withTenant(acmeId, (tx) =>
      tx.risk.findUniqueOrThrow({ where: { id: acmeRiskId } }),
    );
    expect(original.title).toBe("Single-source supplier outage");
  });

  it("does not DELETE another tenant's risk", async () => {
    const result = await db.app.withTenant(globexId, (tx) =>
      tx.risk.deleteMany({ where: { id: acmeRiskId } }),
    );
    expect(result.count).toBe(0);
  });

  it("rejects INSERT that forges another tenant_id", async () => {
    await expect(
      db.app.withTenant(acmeId, (tx) =>
        tx.risk.create({
          data: {
            tenantId: globexId,
            code: "FORGED",
            title: "Forged tenant",
            categoryId: globexCategoryId,
            orgUnitId: globexOrgUnitId,
            ownerMembershipId: globexMembershipId,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects INSERT that references another tenant's category", async () => {
    await expect(
      db.app.withTenant(acmeId, (tx) =>
        tx.risk.create({
          data: {
            tenantId: acmeId,
            code: "XREF",
            title: "Cross-tenant category",
            categoryId: globexCategoryId,
            orgUnitId: acmeOrgUnitId,
            ownerMembershipId: acmeMembershipId,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("keeps aggregates inside the tenant", async () => {
    const acmeCount = await db.app.withTenant(acmeId, (tx) => tx.risk.count());
    const globexCount = await db.app.withTenant(globexId, (tx) => tx.risk.count());
    expect(acmeCount).toBeGreaterThanOrEqual(1);
    expect(globexCount).toBeGreaterThanOrEqual(1);
  });

  it("does not leak rows through joins", async () => {
    const rows = await db.app.withTenant(globexId, (tx) =>
      tx.risk.findMany({
        include: { category: true, owner: true, orgUnit: true },
      }),
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((row) => row.tenantId === globexId)).toBe(true);
    expect(rows.every((row) => row.category.tenantId === globexId)).toBe(true);
  });

  it("returns no tenant rows without SET LOCAL", async () => {
    const risks = await db.app.withoutTenantContext((tx) => tx.risk.findMany());
    expect(risks).toEqual([]);
  });

  it("does not leak tenant context across pooled transactions", async () => {
    for (let i = 0; i < 12; i += 1) {
      await db.app.withTenant(acmeId, (tx) => tx.risk.findMany());
      const setting = await db.app.withoutTenantContext(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ value: string | null }>>`
          SELECT current_setting('app.tenant_id', true) AS value
        `;
        return rows[0]?.value ?? "";
      });
      expect(setting === "" || setting === null).toBe(true);

      const globexRisks = await db.app.withTenant(globexId, (tx) => tx.risk.findMany());
      expect(globexRisks.every((risk) => risk.tenantId === globexId)).toBe(true);
    }
  });

  it("keeps audit events append-only", async () => {
    const event = await db.app.withTenant(acmeId, (tx) =>
      tx.auditEvent.create({
        data: {
          tenantId: acmeId,
          action: "risk.create",
          entityType: "risk",
          entityId: acmeRiskId,
        },
      }),
    );

    await expect(
      db.app.withTenant(acmeId, (tx) =>
        tx.auditEvent.update({
          where: { id: event.id },
          data: { action: "tampered" },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      db.app.withTenant(acmeId, (tx) => tx.auditEvent.delete({ where: { id: event.id } })),
    ).rejects.toThrow();

    const leaked = await db.app.withTenant(globexId, (tx) =>
      tx.auditEvent.findUnique({ where: { id: event.id } }),
    );
    expect(leaked).toBeNull();
  });

  it("prevents org-unit cycles", async () => {
    const child = await db.app.withTenant(acmeId, (tx) =>
      tx.orgUnit.create({
        data: {
          tenantId: acmeId,
          name: "Child",
          type: "team",
          parentId: acmeOrgUnitId,
        },
      }),
    );

    await expect(
      db.app.withTenant(acmeId, (tx) =>
        tx.orgUnit.update({
          where: { id: acmeOrgUnitId },
          data: { parentId: child.id },
        }),
      ),
    ).rejects.toThrow();
  });

  it("does not leak actions or approvals across tenants", async () => {
    const acmeAction = await db.app.withTenant(acmeId, (tx) =>
      tx.riskAction.findFirst({ where: { riskId: acmeRiskId } }),
    );
    expect(acmeAction).not.toBeNull();

    const leaked = await db.app.withTenant(globexId, (tx) =>
      tx.riskAction.findUnique({ where: { id: acmeAction!.id } }),
    );
    expect(leaked).toBeNull();

    await expect(
      db.app.withTenant(globexId, (tx) =>
        tx.approval.create({
          data: {
            tenantId: acmeId,
            entityType: "risk_treatment",
            entityId: acmeRiskId,
            stage: "treatment",
            approverMembershipId: acmeMembershipId,
            decision: "approve",
            comment: "cross-tenant",
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("keeps approvals append-only", async () => {
    const approval = await db.app.withTenant(acmeId, (tx) =>
      tx.approval.create({
        data: {
          tenantId: acmeId,
          entityType: "risk_treatment",
          entityId: acmeRiskId,
          stage: "treatment",
          approverMembershipId: acmeMembershipId,
          decision: "reject",
          comment: "isolation check",
        },
      }),
    );

    await expect(
      db.app.withTenant(acmeId, (tx) =>
        tx.approval.update({
          where: { id: approval.id },
          data: { decision: "approve" },
        }),
      ),
    ).rejects.toThrow();
  });

  it("does not leak form definitions across tenants", async () => {
    const acmeForm = await db.app.withTenant(acmeId, (tx) =>
      tx.formDefinition.create({
        data: {
          tenantId: acmeId,
          key: "isolation_risk",
          name: "Isolation form",
          targetEntity: "risk",
        },
      }),
    );
    const leaked = await db.app.withTenant(globexId, (tx) =>
      tx.formDefinition.findUnique({ where: { id: acmeForm.id } }),
    );
    expect(leaked).toBeNull();

    await expect(
      db.app.withTenant(globexId, (tx) =>
        tx.formVersion.create({
          data: {
            tenantId: acmeId,
            definitionId: acmeForm.id,
            version: 1,
            schemaJson: { fields: [] },
            uiJson: { fieldOrder: [] },
            status: "draft",
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("does not let the app role insert global tenants", async () => {
    await expect(
      db.app.withoutTenantContext((tx) =>
        tx.tenant.create({
          data: { slug: "evil", name: "Evil" },
        }),
      ),
    ).rejects.toThrow();
  });

  it("does not let a tenant grant itself entitlements or see another tenant's modules", async () => {
    await expect(
      db.app.withTenant(acmeId, (tx) =>
        tx.tenantEntitlement.create({
          data: { tenantId: acmeId, moduleKey: "continuity", entitled: true },
        }),
      ),
    ).rejects.toThrow();

    const leaked = await db.app.withTenant(globexId, (tx) =>
      tx.tenantModule.findMany({ where: { tenantId: acmeId } }),
    );
    expect(leaked).toEqual([]);

    const globexModules = await db.app.withTenant(globexId, (tx) => tx.tenantModule.findMany());
    expect(globexModules.every((row) => row.tenantId === globexId)).toBe(true);
  });

  it("does not let a tenant update another tenant's locale", async () => {
    const result = await db.app.withTenant(globexId, (tx) =>
      tx.tenant.updateMany({
        where: { id: acmeId },
        data: { locale: "en" },
      }),
    );
    expect(result.count).toBe(0);
    const acme = await db.app.withoutTenantContext((tx) => tx.tenant.findUniqueOrThrow({ where: { id: acmeId } }));
    expect(acme.locale).toBe("fi");
  });

  it("does not leak attachments or notifications across tenants", async () => {
    const attachment = await db.app.withTenant(acmeId, (tx) =>
      tx.attachment.create({
        data: {
          tenantId: acmeId,
          entityType: "risk",
          entityId: acmeRiskId,
          objectKey: `tenants/${acmeId}/risk/${acmeRiskId}/isolation.txt`,
          filename: "isolation.txt",
          mime: "text/plain",
          size: 12,
          uploadedByMembershipId: acmeMembershipId,
        },
      }),
    );
    const leakedAttachment = await db.app.withTenant(globexId, (tx) =>
      tx.attachment.findUnique({ where: { id: attachment.id } }),
    );
    expect(leakedAttachment).toBeNull();

    const notification = await db.app.withTenant(acmeId, (tx) =>
      tx.notification.create({
        data: {
          tenantId: acmeId,
          membershipId: acmeMembershipId,
          type: "action.assigned",
          payloadJson: { actionId: "isolation" },
          dedupeKey: "isolation-test",
        },
      }),
    );
    const leakedNotification = await db.app.withTenant(globexId, (tx) =>
      tx.notification.findUnique({ where: { id: notification.id } }),
    );
    expect(leakedNotification).toBeNull();
  });

  it("lets the worker poll unprocessed outbox across tenants without the app role", async () => {
    await db.app.withTenant(acmeId, (tx) =>
      tx.outboxEvent.create({
        data: { tenantId: acmeId, type: "action.assigned", payloadJson: { source: "poll-acme" } },
      }),
    );
    await db.app.withTenant(globexId, (tx) =>
      tx.outboxEvent.create({
        data: { tenantId: globexId, type: "action.assigned", payloadJson: { source: "poll-globex" } },
      }),
    );

    const workerRows = await db.worker.withWorkerPoll((tx) =>
      tx.outboxEvent.findMany({ where: { processedAt: null } }),
    );
    expect(workerRows.some((row) => row.tenantId === acmeId)).toBe(true);
    expect(workerRows.some((row) => row.tenantId === globexId)).toBe(true);

    const appRows = await db.app.withWorkerPoll((tx) => tx.outboxEvent.findMany({ where: { processedAt: null } }));
    expect(appRows).toEqual([]);
  });
});
