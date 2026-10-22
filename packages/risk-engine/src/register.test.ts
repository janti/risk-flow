import { loadTenantAccess } from "@riskflow/auth";
import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createForm, publishFormVersion, saveFormDraft } from "@riskflow/form-engine";
import { archiveRisk, createRisk, getRisk, getRiskLookups, listRisks, parseRiskListQuery, updateRisk } from "./register";

describe("risk register", () => {
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

  async function lookups(tenantSlug: string) {
    const admin = await access("acme-admin", tenantSlug === "acme" ? "acme" : "globex");
    return db.app.withTenant(admin.tenant.id, async (tx) => {
      const category = await tx.riskCategory.findFirstOrThrow({ where: { code: "OPS" } });
      const headquarters = await tx.orgUnit.findFirstOrThrow({ where: { name: "Headquarters" } });
      const operations = await tx.orgUnit.findFirstOrThrow({ where: { name: "Operations" } });
      return {
        categoryId: category.id,
        headquartersId: headquarters.id,
        operationsId: operations.id,
        ownerId: admin.membership.id,
      };
    });
  }

  it("lists only the active tenant's risks", async () => {
    const acme = await access("acme-employee", "acme");
    const globex = await access("globex-employee", "globex");
    const acmeList = await listRisks(db.app, acme, {
      limit: 100,
      sort: "createdAt",
    });
    const globexList = await listRisks(db.app, globex, {
      limit: 100,
      sort: "createdAt",
    });
    expect(acmeList).not.toBe("forbidden");
    expect(globexList).not.toBe("forbidden");
    if (typeof acmeList === "string" || typeof globexList === "string") {
      throw new Error("list failed");
    }
    expect(acmeList.items.map((item) => item.code)).toEqual(
      expect.arrayContaining(["COMP-001", "OPS-001", "R-001"]),
    );
    expect(globexList.items.map((item) => item.code)).toEqual(
      expect.arrayContaining(["COMP-001", "OPS-001", "R-001"]),
    );
    expect(acmeList.items.length).toBeGreaterThan(3);
    expect(acmeList.items.find((item) => item.code === "R-001")?.title).toBe("Single-source supplier outage");
    expect(globexList.items.find((item) => item.code === "R-001")?.title).toBe("Unencrypted backup media");
    expect(acmeList.items.some((item) => item.title === "Unencrypted backup media")).toBe(false);
  });

  it("hides the other tenant's risk by id", async () => {
    const acme = await access("acme-admin", "acme");
    const globex = await access("globex-admin", "globex");
    const acmeList = await listRisks(db.app, acme, { limit: 25, sort: "createdAt" });
    if (typeof acmeList === "string") {
      throw new Error("list failed");
    }
    const leaked = await getRisk(db.app, globex, acmeList.items[0]!.id);
    expect(leaked).toBe("not_found");
  });

  it("forbids employees from creating risks", async () => {
    const employee = await access("acme-employee", "acme");
    const ids = await lookups("acme");
    expect(
      await createRisk(db.app, employee, {
        title: "Should not persist",
        categoryId: ids.categoryId,
        orgUnitId: ids.headquartersId,
        ownerId: ids.ownerId,
      }),
    ).toBe("forbidden");
  });

  it("lets a risk manager create, edit and archive a risk", async () => {
    const manager = await access("acme-risk-manager", "acme");
    const ids = await lookups("acme");
    const created = await createRisk(db.app, manager, {
      title: "Key person dependency",
      description: "Operations knowledge is concentrated.",
      categoryId: ids.categoryId,
      orgUnitId: ids.operationsId,
      ownerId: manager.membership.id,
    });
    expect(created).toMatchObject({ title: "Key person dependency", code: "R-002", version: 1 });
    if (typeof created === "string") {
      throw new Error("create failed");
    }

    const updated = await updateRisk(db.app, manager, created.id, {
      version: created.version,
      title: "Key-person dependency",
    });
    expect(updated).toMatchObject({ title: "Key-person dependency", version: 2 });
    if (typeof updated === "string") {
      throw new Error("update failed");
    }

    const stale = await updateRisk(db.app, manager, created.id, {
      version: created.version,
      title: "stale write",
    });
    expect(stale).toBe("stale");

    const archived = await archiveRisk(db.app, manager, created.id, { version: updated.version });
    expect(archived).toMatchObject({ status: "archived", version: 3 });
  });

  it("keeps operations-scoped managers away from headquarters risks", async () => {
    const manager = await access("acme-manager", "acme");
    const ids = await lookups("acme");
    const listed = await listRisks(db.app, manager, { limit: 25, sort: "createdAt" });
    if (typeof listed === "string") {
      throw new Error("list failed");
    }
    expect(listed.items.some((item) => item.code === "R-001")).toBe(false);

    expect(
      await createRisk(db.app, manager, {
        title: "Out of scope",
        categoryId: ids.categoryId,
        orgUnitId: ids.headquartersId,
        ownerId: ids.ownerId,
      }),
    ).toBe("forbidden");
  });

  it("rejects cross-tenant relation ids", async () => {
    const acme = await access("acme-admin", "acme");
    const globex = await access("globex-admin", "globex");
    const globexIds = await db.app.withTenant(globex.tenant.id, async (tx) => {
      const category = await tx.riskCategory.findFirstOrThrow();
      return { categoryId: category.id };
    });
    const acmeIds = await lookups("acme");
    expect(
      await createRisk(db.app, acme, {
        title: "Forged category",
        categoryId: globexIds.categoryId,
        orgUnitId: acmeIds.headquartersId,
        ownerId: acmeIds.ownerId,
      }),
    ).toBe("invalid");
  });

  it("binds published custom fields to new risks and keeps historical records on the original version", async () => {
    const admin = await access("acme-admin", "acme");
    const manager = await access("acme-risk-manager", "acme");
    const ids = await lookups("acme");
    const historical = await createRisk(db.app, manager, {
      title: "Before custom field",
      categoryId: ids.categoryId,
      orgUnitId: ids.headquartersId,
      ownerId: ids.ownerId,
    });
    if (typeof historical === "string") {
      throw new Error("historical create failed");
    }
    expect(historical.formVersion).toBeNull();

    const form = await createForm(db.app, admin, { key: "risk_bind", name: "Risk bind", targetEntity: "risk" });
    if (typeof form === "string") {
      throw new Error("form create failed");
    }
    const fieldId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await saveFormDraft(db.app, admin, form.id, 1, {
      schema: {
        fields: [{ id: fieldId, key: "review_note", type: "shortText", label: "Review note", required: true }],
      },
      ui: { fieldOrder: [fieldId] },
    });
    await publishFormVersion(db.app, admin, form.id, 1);

    const lookupsAfter = await getRiskLookups(db.app, manager);
    expect(lookupsAfter).not.toBe("forbidden");
    if (typeof lookupsAfter === "string") {
      throw new Error("lookups failed");
    }
    expect(lookupsAfter.publishedForm?.schema.fields.map((field) => field.key)).toEqual(["review_note"]);

    const missing = await createRisk(db.app, manager, {
      title: "Missing custom field",
      categoryId: ids.categoryId,
      orgUnitId: ids.headquartersId,
      ownerId: ids.ownerId,
    });
    expect(missing).toBe("invalid");

    const filled = await createRisk(db.app, manager, {
      title: "With custom field",
      categoryId: ids.categoryId,
      orgUnitId: ids.headquartersId,
      ownerId: ids.ownerId,
      customValues: { review_note: "Filled after publish" },
    });
    expect(filled).toMatchObject({
      customValues: { review_note: "Filled after publish" },
    });
    if (typeof filled === "string") {
      throw new Error("filled create failed");
    }
    expect(filled.formVersion?.version).toBe(1);

    const stillHistorical = await getRisk(db.app, manager, historical.id);
    expect(stillHistorical).toMatchObject({ formVersion: null, customValues: {} });
  });

  it("rejects risk APIs when the risk-register module is disabled", async () => {
    const admin = await access("acme-admin", "acme");
    await db.app.withTenant(admin.tenant.id, (tx) =>
      tx.tenantModule.update({
        where: { tenantId_moduleKey: { tenantId: admin.tenant.id, moduleKey: "risk-register" } },
        data: { enabled: false },
      }),
    );
    const disabled = await access("acme-admin", "acme");
    expect(await listRisks(db.app, disabled, { limit: 25, sort: "createdAt" })).toBe("module_disabled");
    await db.app.withTenant(admin.tenant.id, (tx) =>
      tx.tenantModule.update({
        where: { tenantId_moduleKey: { tenantId: admin.tenant.id, moduleKey: "risk-register" } },
        data: { enabled: true },
      }),
    );
  });

  it("parses list query defaults and rejects invalid filters", async () => {
    expect(parseRiskListQuery(new URLSearchParams())).toMatchObject({
      limit: 25,
      sort: "createdAt",
    });
    expect(parseRiskListQuery(new URLSearchParams("status=nope"))).toBe("invalid");
  });
});
