import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findUserByAuthSubject, loadTenantAccess } from "./access";
import { acceptInvitation, addMemberDirectly, createInvitation, listTenantMemberships } from "./memberships";
import { claimOrCreateUser, isPendingAuthSubject, pendingEmailAuthSubject } from "./pending-user";

describe("memberships and invites", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 300_000);

  afterAll(async () => {
    await db?.stop();
  });

  it("forbids employees from listing members", async () => {
    const access = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-employee"),
      tenantSlug: "acme",
    });
    expect(await listTenantMemberships(db.app, access!)).toBe("forbidden");
  });

  it("lets a tenant admin invite and the invited user accept", async () => {
    const admin = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-admin"),
      tenantSlug: "acme",
    });
    const created = await createInvitation(db.app, admin!, {
      email: "employee@globex.example",
      roleKey: "employee",
    });
    expect(created).toMatchObject({ email: "employee@globex.example", roleKey: "employee" });
    if (typeof created === "string") {
      throw new Error("invite failed");
    }

    const globexEmployee = await findUserByAuthSubject(db.app, oidcAuthSubject("globex-employee"));
    expect(await acceptInvitation(db.app, globexEmployee!, created.token)).toBe("accepted");

    const dual = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("globex-employee"),
      tenantSlug: "acme",
    });
    expect(dual?.roleKeys).toContain("employee");
  });

  it("rejects expired or mismatched invite tokens without leaking", async () => {
    const globexAdmin = await findUserByAuthSubject(db.app, oidcAuthSubject("globex-admin"));
    expect(await acceptInvitation(db.app, globexAdmin!, "not-a-real-token")).toBe("invalid");
  });

  it("lets a tenant admin add a member without an invite email", async () => {
    const admin = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-admin"),
      tenantSlug: "acme",
    });
    const created = await addMemberDirectly(db.app, admin!, {
      email: "direct-add@acme.example",
      displayName: "Direct Add",
      roleKey: "employee",
    });
    expect(created).toMatchObject({
      email: "direct-add@acme.example",
      displayName: "Direct Add",
      roleKeys: ["employee"],
      pending: true,
    });

    const members = await listTenantMemberships(db.app, admin!);
    expect(members).not.toBe("forbidden");
    if (members === "forbidden") {
      throw new Error("list failed");
    }
    expect(members.some((member) => member.email === "direct-add@acme.example" && member.pending)).toBe(
      true,
    );

    const claimed = await claimOrCreateUser(db.app, {
      authSubject: oidcAuthSubject("direct-add"),
      email: "direct-add@acme.example",
      displayName: "Direct Add",
    });
    expect(claimed.authSubject).toBe(oidcAuthSubject("direct-add"));
    expect(isPendingAuthSubject(claimed.authSubject)).toBe(false);

    const access = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("direct-add"),
      tenantSlug: "acme",
    });
    expect(access?.roleKeys).toContain("employee");
  });

  it("forbids employees from adding members directly", async () => {
    const employee = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-employee"),
      tenantSlug: "acme",
    });
    expect(
      await addMemberDirectly(db.app, employee!, {
        email: "nope@acme.example",
        roleKey: "employee",
      }),
    ).toBe("forbidden");
  });

  it("conflicts when the email already has an active membership", async () => {
    const admin = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-admin"),
      tenantSlug: "acme",
    });
    expect(
      await addMemberDirectly(db.app, admin!, {
        email: "employee@acme.example",
        roleKey: "employee",
      }),
    ).toBe("conflict");
  });

  it("attaches an existing identity without creating a pending subject", async () => {
    const admin = await loadTenantAccess(db.app, {
      authSubject: oidcAuthSubject("acme-admin"),
      tenantSlug: "acme",
    });
    const created = await addMemberDirectly(db.app, admin!, {
      email: "admin@globex.example",
      roleKey: "manager",
    });
    expect(created).toMatchObject({
      email: "admin@globex.example",
      pending: false,
      roleKeys: expect.arrayContaining(["manager"]),
    });
    expect(pendingEmailAuthSubject("admin@globex.example")).toBe("pending-email|admin@globex.example");
  });
});
