import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadTenantAccess } from "./access";
import { createOrgUnit, listOrgUnits, patchOrgUnit } from "./org-units";
import { listRoleMatrix, patchRoleMatrix } from "./roles";
import { patchTenantSettings } from "./tenant-settings";

describe("tenant organization and settings", () => {
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

  it("lets a tenant admin grow the org tree and rejects cycles", async () => {
    const admin = await access("acme-admin", "acme");
    const tree = await listOrgUnits(db.app, admin);
    if (typeof tree === "string") {
      throw new Error("list failed");
    }
    const headquarters = tree.find((unit) => unit.name === "Headquarters");
    expect(headquarters).toBeDefined();

    const created = await createOrgUnit(db.app, admin, {
      name: "Sprint 09 Team",
      type: "team",
      parentId: headquarters!.id,
    });
    if (typeof created === "string") {
      throw new Error("create failed");
    }
    const team = created
      .flatMap((unit) => [unit, ...unit.children, ...unit.children.flatMap((child) => child.children)])
      .find((unit) => unit.name === "Sprint 09 Team");
    expect(team?.parentId).toBe(headquarters!.id);

    expect(await patchOrgUnit(db.app, admin, { id: headquarters!.id, parentId: team!.id })).toBe("conflict");
  });

  it("keeps tenant-admin management permissions", async () => {
    const admin = await access("acme-admin", "acme");
    const roles = await listRoleMatrix(db.app, admin);
    if (typeof roles === "string") {
      throw new Error("roles failed");
    }
    const tenantAdmin = roles.find((role) => role.key === "tenant-admin");
    expect(tenantAdmin).toBeDefined();
    expect(
      await patchRoleMatrix(db.app, admin, {
        roles: [{ roleId: tenantAdmin!.id, permissionKeys: ["risk:read"] }],
      }),
    ).toBe("conflict");
  });

  it("stores locale and branding without dropping policy settings", async () => {
    const admin = await access("acme-admin", "acme");
    const updated = await patchTenantSettings(db.app, admin, {
      locale: "en",
      branding: { productName: "Acme Risk", primaryColor: "#112233" },
    });
    if (typeof updated === "string") {
      throw new Error("settings failed");
    }
    expect(updated).toMatchObject({
      locale: "en",
      branding: { productName: "Acme Risk", primaryColor: "#112233" },
    });
    const tenant = await db.app.withTenant(admin.tenant.id, (tx) =>
      tx.tenant.findUniqueOrThrow({ where: { id: admin.tenant.id } }),
    );
    expect(tenant.settingsJson).toMatchObject({
      separationOfDuties: true,
      branding: { productName: "Acme Risk", primaryColor: "#112233" },
    });
  });

  it("forbids employees from managing organization", async () => {
    const employee = await access("acme-employee", "acme");
    expect(await listOrgUnits(db.app, employee)).toBe("forbidden");
    expect(await listRoleMatrix(db.app, employee)).toBe("forbidden");
  });
});
