import { loadTenantAccess } from "@riskflow/auth";
import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAction, listActions, updateAction } from "./actions";
import { listRisks } from "./register";
import { decideApproval, getTreatmentBundle, submitTreatment } from "./treatments";

describe("treatments, actions and approvals", () => {
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
    return { admin, risk };
  }

  it("forbids employees from assigning actions", async () => {
    const { risk, admin } = await acmeRisk();
    const employee = await access("acme-employee", "acme");
    expect(
      await createAction(db.app, employee, risk.id, {
        title: "Should fail",
        assigneeMembershipId: admin.membership.id,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).toBe("forbidden");
  });

  it("hides headquarters actions from an operations manager", async () => {
    const { risk, admin } = await acmeRisk();
    const manager = await access("acme-manager", "acme");
    expect(
      await createAction(db.app, manager, risk.id, {
        title: "Out of scope",
        assigneeMembershipId: admin.membership.id,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).toBe("not_found");
  });

  it("hides the other tenant's actions", async () => {
    const { risk } = await acmeRisk();
    const globex = await access("globex-admin", "globex");
    const listed = await listActions(db.app, globex, {
      limit: 25,
      riskId: risk.id,
      mine: false,
      overdue: false,
    });
    expect(listed).toBe("not_found");
  });

  it("lets a risk manager complete an assigned action and records outbox plus overdue", async () => {
    const { risk, admin } = await acmeRisk();
    const manager = await access("acme-risk-manager", "acme");
    const created = await createAction(db.app, manager, risk.id, {
      title: "Document residual controls",
      assigneeMembershipId: manager.membership.id,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(created).not.toBe("forbidden");
    if (typeof created === "string") {
      throw new Error("create failed");
    }
    expect(created.overdue).toBe(false);

    const scopedManager = await access("acme-manager", "acme");
    const globex = await access("globex-admin", "globex");
    expect(await updateAction(db.app, scopedManager, created.id, { status: "completed" })).toBe("forbidden");
    expect(await updateAction(db.app, globex, created.id, { status: "completed" })).toBe("not_found");
    expect(await updateAction(db.app, admin, created.id, { status: "in_progress" })).toMatchObject({
      status: "in_progress",
    });
    const completed = await updateAction(db.app, manager, created.id, { status: "completed" });
    expect(completed).toMatchObject({ status: "completed", overdue: false });

    const overdue = await listActions(db.app, manager, { limit: 25, mine: true, overdue: true });
    if (typeof overdue === "string") {
      throw new Error("list failed");
    }
    expect(overdue.items.some((item) => item.title === "Confirm alternate supplier" && item.overdue)).toBe(true);

    const outbox = await db.app.withTenant(manager.tenant.id, (tx) =>
      tx.outboxEvent.findMany({ where: { type: { in: ["action.assigned", "action.completed"] } } }),
    );
    expect(outbox.some((event) => event.type === "action.assigned" && event.processedAt === null)).toBe(true);
    expect(outbox.some((event) => event.type === "action.completed")).toBe(true);
  });

  it("blocks self-approval when separation of duties is required and keeps the decision auditable", async () => {
    const { risk, admin } = await acmeRisk();
    const manager = await access("acme-risk-manager", "acme");
    const submitted = await submitTreatment(db.app, manager, risk.id, {
      strategy: "reduce",
      targetDate: "2026-12-31",
    });
    expect(submitted).toMatchObject({ strategy: "reduce", status: "pending" });
    expect(await decideApproval(db.app, manager, risk.id, { decision: "approve", comment: "Own work" })).toBe(
      "forbidden",
    );

    const employee = await access("acme-employee", "acme");
    expect(await decideApproval(db.app, employee, risk.id, { decision: "approve", comment: "No right" })).toBe(
      "forbidden",
    );

    const decided = await decideApproval(db.app, admin, risk.id, {
      decision: "approve",
      comment: "Controls are sufficient.",
    });
    expect(decided).toMatchObject({
      treatment: { status: "approved" },
      approval: { decision: "approve", comment: "Controls are sufficient." },
    });

    const bundle = await getTreatmentBundle(db.app, manager, risk.id);
    if (typeof bundle === "string") {
      throw new Error("bundle failed");
    }
    expect(bundle.policy.separationOfDuties).toBe(true);
    expect(bundle.approvals).toHaveLength(1);
    expect(bundle.treatment?.status).toBe("approved");

    const audit = await db.app.withTenant(admin.tenant.id, (tx) =>
      tx.auditEvent.findMany({ where: { action: "approval.decide" } }),
    );
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });
});
