import { loadTenantAccess } from "@riskflow/auth";
import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createForm,
  createFormVersion,
  getForm,
  listForms,
  previewFormImpact,
  publishFormVersion,
  saveFormDraft,
} from "./service";
import type { FormField } from "./schema";

describe("form publishing", () => {
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

  function noteField(label = "Review note"): FormField {
    return {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      key: "review_note",
      type: "shortText",
      label,
      required: true,
    };
  }

  it("forbids employees from managing forms", async () => {
    const employee = await access("acme-employee", "acme");
    expect(await listForms(db.app, employee)).toBe("forbidden");
    expect(await createForm(db.app, employee, { key: "risk", name: "Risk", targetEntity: "risk" })).toBe(
      "forbidden",
    );
  });

  it("publishes an immutable version and keeps historical records on the original schema", async () => {
    const admin = await access("acme-admin", "acme");
    const created = await createForm(db.app, admin, { key: "risk", name: "Risk form", targetEntity: "risk" });
    expect(created).not.toBe("forbidden");
    if (typeof created === "string") {
      throw new Error("create failed");
    }
    const draft = created.versions[0]!;
    const saved = await saveFormDraft(db.app, admin, created.id, draft.version, {
      schema: { fields: [noteField()] },
      ui: { fieldOrder: [noteField().id] },
    });
    expect(saved).toMatchObject({ status: "draft", version: 1 });
    if (typeof saved === "string") {
      throw new Error("save failed");
    }

    const published = await publishFormVersion(db.app, admin, created.id, 1);
    expect(published).toMatchObject({
      version: { status: "published", version: 1 },
      impact: { addedKeys: ["review_note"], removedKeys: [], affectedRecordCount: 0 },
    });
    if (typeof published === "string") {
      throw new Error("publish failed");
    }

    await expect(
      db.app.withTenant(admin.tenant.id, (tx) =>
        tx.formVersion.update({
          where: { id: published.version.id },
          data: { schemaJson: { fields: [] } },
        }),
      ),
    ).rejects.toThrow(/immutable/i);

    const next = await createFormVersion(db.app, admin, created.id, {});
    expect(next).toMatchObject({ version: 2, status: "draft" });
    if (typeof next === "string") {
      throw new Error("draft v2 failed");
    }
    const again = await createFormVersion(db.app, admin, created.id, {});
    expect(again).toMatchObject({ id: next.id, version: 2, status: "draft" });

    const republishConflict = await publishFormVersion(db.app, admin, created.id, 1);
    expect(republishConflict).toBe("conflict");

    const emptyDraft = await saveFormDraft(db.app, admin, created.id, 2, { schema: { fields: [] } });
    expect(emptyDraft).not.toBe("forbidden");
    const impact = await previewFormImpact(db.app, admin, created.id, 2);
    expect(impact).toMatchObject({
      impact: { removedKeys: ["review_note"], addedKeys: [] },
    });
  });

  it("does not leak form definitions across tenants", async () => {
    const acme = await access("acme-admin", "acme");
    const globex = await access("globex-admin", "globex");
    const acmeForm = await createForm(db.app, acme, {
      key: "acme_only",
      name: "Acme only",
      targetEntity: "risk",
    });
    if (typeof acmeForm === "string") {
      throw new Error("acme form failed");
    }
    expect(await getForm(db.app, globex, acmeForm.id)).toBe("not_found");
    const globexForms = await listForms(db.app, globex);
    expect(globexForms).not.toBe("forbidden");
    if (typeof globexForms === "string") {
      throw new Error("globex list failed");
    }
    expect(globexForms.some((form) => form.id === acmeForm.id)).toBe(false);
  });
});
