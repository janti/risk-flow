import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTenantAccess } from "@riskflow/auth";
import { oidcAuthSubject } from "@riskflow/database";
import { startTestDatabase, type TestDatabase } from "@riskflow/database/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAction } from "./actions";
import {
  createAttachmentDownloadUrl,
  createUploadIntent,
  listRiskAttachments,
  putAttachmentContent,
  readAttachmentContent,
} from "./attachments";
import { listAuditEvents } from "./audit";
import { drainOutbox, processOutboxEvent, sendOverdueReminders } from "./jobs";
import { listNotifications } from "./notifications";
import { objectKey } from "./storage";

describe("sprint 10 attachments, notifications and audit", () => {
  let db: TestDatabase;
  let storageDir: string;
  const previousStorage = process.env.OBJECT_STORAGE_DIR;

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "riskflow-s10-"));
    process.env.OBJECT_STORAGE_DIR = storageDir;
    db = await startTestDatabase();
  }, 300_000);

  afterAll(async () => {
    if (previousStorage === undefined) {
      delete process.env.OBJECT_STORAGE_DIR;
    } else {
      process.env.OBJECT_STORAGE_DIR = previousStorage;
    }
    await db?.stop();
    await rm(storageDir, { recursive: true, force: true });
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

  it("keeps uploads tenant-scoped, expires signed URLs and rejects the other tenant", async () => {
    const acme = await access("acme-admin", "acme");
    const globex = await access("globex-admin", "globex");
    const body = new TextEncoder().encode("risk evidence");
    const risk = await db.app.withTenant(acme.tenant.id, (tx) =>
      tx.risk.findFirstOrThrow({ where: { code: "R-001" } }),
    );

    const intent = await createUploadIntent(
      db.app,
      acme,
      {
        entityType: "risk",
        entityId: risk.id,
        filename: "evidence.txt",
        mime: "text/plain",
        size: body.byteLength,
      },
      "http://127.0.0.1:3000",
    );
    expect(typeof intent).not.toBe("string");
    if (typeof intent === "string") {
      throw new Error("intent failed");
    }
    expect(intent.attachment.objectKey.startsWith(`tenants/${acme.tenant.id}/`)).toBe(true);
    expect(intent.uploadUrl).toContain("sig=");

    const uploadUrl = new URL(intent.uploadUrl);
    const put = await putAttachmentContent(
      db.app,
      acme,
      intent.attachment.id,
      body,
      Number(uploadUrl.searchParams.get("exp")),
      uploadUrl.searchParams.get("sig") ?? "",
    );
    expect(typeof put).not.toBe("string");

    const expired = await putAttachmentContent(
      db.app,
      acme,
      intent.attachment.id,
      body,
      Math.floor(Date.now() / 1000) - 10,
      uploadUrl.searchParams.get("sig") ?? "",
    );
    expect(expired).toBe("expired");

    const pendingDownload = await createAttachmentDownloadUrl(db.app, acme, intent.attachment.id, "http://127.0.0.1:3000");
    expect(pendingDownload).toBe("pending_scan");

    const drained = await drainOutbox(db.worker);
    expect(drained.processed).toBeGreaterThan(0);
    const listed = await listRiskAttachments(db.app, acme, risk.id);
    if (typeof listed === "string") {
      throw new Error("list failed");
    }
    expect(listed[0]?.scanStatus).toBe("clean");

    const download = await createAttachmentDownloadUrl(db.app, acme, intent.attachment.id, "http://127.0.0.1:3000");
    if (typeof download === "string") {
      throw new Error("download url failed");
    }
    const downloadUrl = new URL(download.downloadUrl);
    const content = await readAttachmentContent(
      db.app,
      acme,
      intent.attachment.id,
      Number(downloadUrl.searchParams.get("exp")),
      downloadUrl.searchParams.get("sig") ?? "",
    );
    if (typeof content === "string") {
      throw new Error("read failed");
    }
    expect(Buffer.from(content.body).toString("utf8")).toBe("risk evidence");

    expect(await createAttachmentDownloadUrl(db.app, globex, intent.attachment.id, "http://127.0.0.1:3000")).toBe(
      "not_found",
    );
    expect(
      await readAttachmentContent(
        db.app,
        globex,
        intent.attachment.id,
        Number(downloadUrl.searchParams.get("exp")),
        downloadUrl.searchParams.get("sig") ?? "",
      ),
    ).toBe("not_found");
  });

  it("rejects a stored object key that belongs to another tenant", async () => {
    const acme = await access("acme-admin", "acme");
    const globex = await access("globex-admin", "globex");
    const risk = await db.app.withTenant(acme.tenant.id, (tx) =>
      tx.risk.findFirstOrThrow({ where: { code: "R-001" } }),
    );
    const foreignKey = objectKey(globex.tenant.id, "risk", risk.id, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "x.txt");
    const planted = await db.app.withTenant(acme.tenant.id, (tx) =>
      tx.attachment.create({
        data: {
          tenantId: acme.tenant.id,
          entityType: "risk",
          entityId: risk.id,
          objectKey: foreignKey,
          filename: "x.txt",
          mime: "text/plain",
          size: 1,
          scanStatus: "clean",
          uploadedAt: new Date(),
          uploadedByMembershipId: acme.membership.id,
        },
      }),
    );
    expect(await createAttachmentDownloadUrl(db.app, acme, planted.id, "http://127.0.0.1:3000")).toBe("not_found");
  });

  it("processes outbox events idempotently and skips side effects when the module is disabled", async () => {
    const acme = await access("acme-admin", "acme");
    const employee = await access("acme-employee", "acme");
    const risk = await db.app.withTenant(acme.tenant.id, (tx) =>
      tx.risk.findFirstOrThrow({ where: { code: "R-001" } }),
    );
    const created = await createAction(db.app, acme, risk.id, {
      title: "Sprint 10 notify",
      assigneeMembershipId: employee.membership.id,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    if (typeof created === "string") {
      throw new Error("create action failed");
    }
    const first = await drainOutbox(db.worker);
    expect(first.processed).toBeGreaterThan(0);
    const second = await drainOutbox(db.worker);
    expect(second.processed).toBe(0);

    const inbox = await listNotifications(db.app, employee, { limit: 25, unread: false });
    if (typeof inbox === "string") {
      throw new Error("inbox failed");
    }
    const assigned = inbox.items.filter((item) => item.type === "action.assigned");
    expect(assigned.length).toBeGreaterThan(0);
    const assignedCount = assigned.length;

    const event = await db.app.withTenant(acme.tenant.id, (tx) =>
      tx.outboxEvent.findFirstOrThrow({
        where: { type: "action.assigned" },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(await processOutboxEvent(db.worker, acme.tenant.id, event.id)).toBe("skipped");
    const again = await listNotifications(db.app, employee, { limit: 25, unread: false });
    if (typeof again === "string") {
      throw new Error("inbox failed");
    }
    expect(again.items.filter((item) => item.type === "action.assigned")).toHaveLength(assignedCount);

    const disabledEvent = await db.app.withTenant(acme.tenant.id, (tx) =>
      tx.outboxEvent.create({
        data: {
          tenantId: acme.tenant.id,
          type: "action.assigned",
          payloadJson: {
            actionId: created.id,
            riskId: risk.id,
            assigneeMembershipId: employee.membership.id,
          },
        },
      }),
    );
    await db.app.withTenant(acme.tenant.id, (tx) =>
      tx.tenantModule.updateMany({ where: { moduleKey: "risk-register" }, data: { enabled: false } }),
    );
    expect(await processOutboxEvent(db.worker, acme.tenant.id, disabledEvent.id)).toBe("disabled");
    const employeeAfterDisable = await access("acme-employee", "acme");
    expect(await listNotifications(db.app, employeeAfterDisable, { limit: 25, unread: false })).toBe("module_disabled");
    await db.app.withTenant(acme.tenant.id, (tx) =>
      tx.tenantModule.updateMany({ where: { moduleKey: "risk-register" }, data: { enabled: true } }),
    );
  });

  it("creates overdue reminders once per due date", async () => {
    const manager = await access("acme-manager", "acme");
    const first = await sendOverdueReminders(db.worker);
    const second = await sendOverdueReminders(db.worker);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
    const inbox = await listNotifications(db.app, manager, { limit: 50, unread: false });
    if (typeof inbox === "string") {
      throw new Error("inbox failed");
    }
    expect(inbox.items.some((item) => item.type === "action.overdue")).toBe(true);
  });

  it("paginates immutable audit events and requires audit:read", async () => {
    const admin = await access("acme-admin", "acme");
    const employee = await access("acme-employee", "acme");
    expect(await listAuditEvents(db.app, employee, { limit: 10 })).toBe("forbidden");
    const page = await listAuditEvents(db.app, admin, { limit: 2 });
    if (typeof page === "string") {
      throw new Error("audit failed");
    }
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeTruthy();
    const next = await listAuditEvents(db.app, admin, { limit: 2, cursor: page.nextCursor ?? undefined });
    if (typeof next === "string") {
      throw new Error("audit page 2 failed");
    }
    expect(next.items[0]?.id).not.toBe(page.items[0]?.id);
  });
});
