import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authorize, loadTenantAccess, updateUserLocale } from "./access";

describe("tenant access", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 300_000);

  afterAll(async () => {
    await db?.stop();
  });

  it("lets a tenant admin use acme and not globex", async () => {
    const acme = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-admin"),
      tenantSlug: "acme",
    });
    const globex = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-admin"),
      tenantSlug: "globex",
    });

    expect(acme?.user.locale).toBe("fi");
    expect(acme?.roleKeys).toContain("tenant-admin");
    expect(authorize(acme!, "users:manage")).toBe(true);
    expect(acme?.enabledModules).toContain("risk-register");
    expect(globex).toBeNull();
  });

  it("keeps globex users out of acme", async () => {
    const leaked = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("globex-employee"),
      tenantSlug: "acme",
    });
    expect(leaked).toBeNull();
  });

  it("drops revoked members immediately", async () => {
    const access = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-revoked"),
      tenantSlug: "acme",
    });
    expect(access).toBeNull();
  });

  it("does not give platform admins tenant data", async () => {
    const access = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("platform-admin"),
      tenantSlug: "acme",
    });
    expect(access).toBeNull();
  });

  it("scopes a manager to the operations unit", async () => {
    const access = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-manager"),
      tenantSlug: "acme",
    });
    expect(access).not.toBeNull();
    expect(authorize(access!, "risk:update")).toBe(true);
    expect(authorize(access!, "users:manage")).toBe(false);

    const units = await db.app.withTenant(access!.tenant.id, (tx) => tx.orgUnit.findMany());
    const operations = units.find((unit) => unit.name === "Operations");
    const hq = units.find((unit) => unit.name === "Headquarters");
    expect(operations).toBeDefined();
    expect(authorize(access!, "risk:update", { orgUnitId: operations!.id })).toBe(true);
    expect(authorize(access!, "risk:update", { orgUnitId: hq!.id })).toBe(false);
  });

  it("limits employees to risk:read", async () => {
    const access = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-employee"),
      tenantSlug: "acme",
    });
    expect(authorize(access!, "risk:read")).toBe(true);
    expect(authorize(access!, "risk:create")).toBe(false);
  });

  it("seeds a login for every system role in both tenants", async () => {
    const accounts = [
      { accountId: "acme-admin", tenantSlug: "acme", role: "tenant-admin" },
      { accountId: "acme-manager", tenantSlug: "acme", role: "manager" },
      { accountId: "acme-employee", tenantSlug: "acme", role: "employee" },
      { accountId: "acme-risk-manager", tenantSlug: "acme", role: "risk-manager" },
      { accountId: "globex-admin", tenantSlug: "globex", role: "tenant-admin" },
      { accountId: "globex-manager", tenantSlug: "globex", role: "manager" },
      { accountId: "globex-employee", tenantSlug: "globex", role: "employee" },
      { accountId: "globex-risk-manager", tenantSlug: "globex", role: "risk-manager" },
    ] as const;

    for (const account of accounts) {
      const access = await loadTenantAccess(db.app, {
        authSubject: oidcAuthSubject(account.accountId),
        tenantSlug: account.tenantSlug,
      });
      expect(access?.roleKeys, account.accountId).toContain(account.role);
    }
  });

  it("stores the UI locale on the user row", async () => {
    const access = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-admin"),
      tenantSlug: "acme",
    });
    expect(access).not.toBeNull();
    const updated = await updateUserLocale(db.app, access!.user, "sv");
    expect(updated.locale).toBe("sv");
    const reloaded = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-admin"),
      tenantSlug: "acme",
    });
    expect(reloaded?.user.locale).toBe("sv");
    await updateUserLocale(db.app, reloaded!.user, "fi");
  });
});
