import { loadTenantAccess } from "@riskflow/auth";
import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listIncidents } from "./incidents";
import { listTenantModules, patchTenantModules } from "./service";

describe("tenant modules", () => {
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

  it("lets a tenant admin enable an entitled module and rejects unentitled ones", async () => {
    const admin = await access("acme-admin", "acme");
    const listed = await listTenantModules(db.app, admin);
    expect(listed).not.toBe("forbidden");
    if (listed === "forbidden") {
      throw new Error("list failed");
    }
    expect(listed.find((item) => item.key === "risk-register")).toMatchObject({
      entitled: true,
      enabled: true,
    });
    expect(listed.find((item) => item.key === "incidents")).toMatchObject({
      entitled: true,
      enabled: false,
    });
    expect(listed.find((item) => item.key === "continuity")).toMatchObject({ entitled: false });
    expect(await listIncidents(admin)).toBe("module_disabled");

    const enabled = await patchTenantModules(db.app, admin, {
      modules: [{ key: "incidents", enabled: true }],
    });
    expect(enabled).not.toBe("forbidden");
    if (typeof enabled === "string") {
      throw new Error("enable failed");
    }
    expect(enabled.find((item) => item.key === "incidents")?.enabled).toBe(true);
    const refreshed = await access("acme-admin", "acme");
    expect(await listIncidents(refreshed)).toEqual({ incidents: [] });

    expect(
      await patchTenantModules(db.app, admin, { modules: [{ key: "continuity", enabled: true }] }),
    ).toBe("not_entitled");
  });

  it("refuses to disable a module that other enabled modules depend on", async () => {
    const admin = await access("acme-admin", "acme");
    await patchTenantModules(db.app, admin, { modules: [{ key: "incidents", enabled: true }] });
    expect(
      await patchTenantModules(db.app, admin, { modules: [{ key: "risk-register", enabled: false }] }),
    ).toBe("conflict");
  });

  it("does not let globex enable a module it is not entitled to", async () => {
    const globex = await access("globex-admin", "globex");
    expect(
      await patchTenantModules(db.app, globex, { modules: [{ key: "incidents", enabled: true }] }),
    ).toBe("not_entitled");
    const listed = await listTenantModules(db.app, globex);
    if (listed === "forbidden") {
      throw new Error("list failed");
    }
    expect(listed.find((item) => item.key === "audits")?.entitled).toBe(true);
    expect(listed.find((item) => item.key === "incidents")?.entitled).toBe(false);
  });

  it("forbids employees from managing modules", async () => {
    const employee = await access("acme-employee", "acme");
    expect(await listTenantModules(db.app, employee)).toBe("forbidden");
  });

  it("keeps module rows and business records after disablement", async () => {
    const admin = await access("acme-admin", "acme");
    await patchTenantModules(db.app, admin, { modules: [{ key: "incidents", enabled: true }] });
    const disabled = await patchTenantModules(db.app, admin, { modules: [{ key: "incidents", enabled: false }] });
    expect(disabled).not.toBe("forbidden");
    if (typeof disabled === "string") {
      throw new Error("disable failed");
    }
    expect(disabled.find((item) => item.key === "incidents")).toMatchObject({ entitled: true, enabled: false });

    const row = await db.app.withTenant(admin.tenant.id, (tx) =>
      tx.tenantModule.findUnique({
        where: { tenantId_moduleKey: { tenantId: admin.tenant.id, moduleKey: "incidents" } },
      }),
    );
    expect(row).not.toBeNull();
    expect(row?.enabled).toBe(false);

    const risks = await db.app.withTenant(admin.tenant.id, (tx) => tx.risk.count());
    expect(risks).toBeGreaterThanOrEqual(1);
  });
});
