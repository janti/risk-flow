import type { TenantDatabase, TenantTransaction } from "@riskflow/database";
import { upsertNotification } from "./notifications";
import { scanUploadedObject } from "./storage";

async function riskRegisterEnabled(tx: TenantTransaction): Promise<boolean> {
  const row = await tx.tenantModule.findFirst({
    where: { moduleKey: "risk-register", enabled: true },
    select: { moduleKey: true },
  });
  return Boolean(row);
}

export type OutboxProcessResult = "processed" | "skipped" | "disabled";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function processOutboxEvent(
  db: TenantDatabase,
  tenantId: string,
  eventId: string,
  now = new Date(),
): Promise<OutboxProcessResult> {
  return db.withTenant(tenantId, async (tx) => {
    const event = await tx.outboxEvent.findFirst({ where: { id: eventId } });
    if (!event || event.processedAt) {
      return "skipped";
    }
    if (!(await riskRegisterEnabled(tx))) {
      await tx.outboxEvent.update({ where: { id: event.id }, data: { processedAt: now } });
      return "disabled";
    }

    const payload = asRecord(event.payloadJson);
    if (event.type === "action.assigned") {
      const assigneeMembershipId = asString(payload.assigneeMembershipId);
      const actionId = asString(payload.actionId);
      const riskId = asString(payload.riskId);
      if (assigneeMembershipId && actionId) {
        await upsertNotification(tx, {
          tenantId,
          membershipId: assigneeMembershipId,
          type: "action.assigned",
          dedupeKey: `action.assigned:${event.id}`,
          payload: { actionId, riskId },
        });
      }
    } else if (event.type === "action.completed") {
      const actionId = asString(payload.actionId);
      const riskId = asString(payload.riskId);
      if (actionId && riskId) {
        const risk = await tx.risk.findFirst({ where: { id: riskId } });
        if (risk) {
          await upsertNotification(tx, {
            tenantId,
            membershipId: risk.ownerMembershipId,
            type: "action.completed",
            dedupeKey: `action.completed:${event.id}`,
            payload: { actionId, riskId },
          });
        }
      }
    } else if (event.type === "treatment.submitted") {
      const riskId = asString(payload.riskId);
      if (riskId) {
        const risk = await tx.risk.findFirst({ where: { id: riskId } });
        if (risk) {
          await upsertNotification(tx, {
            tenantId,
            membershipId: risk.ownerMembershipId,
            type: "treatment.submitted",
            dedupeKey: `treatment.submitted:${event.id}`,
            payload: { riskId, treatmentId: asString(payload.treatmentId) },
          });
        }
      }
    } else if (event.type === "attachment.uploaded") {
      const attachmentId = asString(payload.attachmentId);
      if (attachmentId) {
        const attachment = await tx.attachment.findFirst({ where: { id: attachmentId } });
        if (attachment) {
          const scanStatus = scanUploadedObject(attachment.mime, attachment.filename);
          await tx.attachment.update({
            where: { id: attachment.id },
            data: { scanStatus },
          });
        }
      }
    }

    await tx.outboxEvent.update({ where: { id: event.id }, data: { processedAt: now } });
    return "processed";
  });
}

export async function drainOutbox(
  db: TenantDatabase,
  limit = 25,
  now = new Date(),
): Promise<{ processed: number; skipped: number; disabled: number }> {
  const pending = await db.withWorkerPoll((tx) =>
    tx.outboxEvent.findMany({
      where: { processedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, tenantId: true },
    }),
  );
  const summary = { processed: 0, skipped: 0, disabled: 0 };
  for (const event of pending) {
    const result = await processOutboxEvent(db, event.tenantId, event.id, now);
    summary[result] += 1;
  }
  return summary;
}

export async function sendOverdueReminders(
  db: TenantDatabase,
  now = new Date(),
): Promise<number> {
  const overdue = await db.withWorkerPoll((tx) =>
    tx.riskAction.findMany({
      where: { status: { not: "completed" }, dueAt: { lt: now } },
      select: { id: true, tenantId: true, riskId: true, assigneeMembershipId: true, dueAt: true, title: true },
      take: 100,
    }),
  );
  let created = 0;
  const byTenant = new Map<string, typeof overdue>();
  for (const action of overdue) {
    const list = byTenant.get(action.tenantId) ?? [];
    list.push(action);
    byTenant.set(action.tenantId, list);
  }
  for (const [tenantId, actions] of byTenant) {
    const count = await db.withTenant(tenantId, async (tx) => {
      if (!(await riskRegisterEnabled(tx))) {
        return 0;
      }
      let added = 0;
      for (const action of actions) {
        const before = await tx.notification.count({
          where: {
            membershipId: action.assigneeMembershipId,
            dedupeKey: `action.overdue:${action.id}:${action.dueAt.toISOString()}`,
          },
        });
        await upsertNotification(tx, {
          tenantId,
          membershipId: action.assigneeMembershipId,
          type: "action.overdue",
          dedupeKey: `action.overdue:${action.id}:${action.dueAt.toISOString()}`,
          payload: { actionId: action.id, riskId: action.riskId, title: action.title },
        });
        const after = await tx.notification.count({
          where: {
            membershipId: action.assigneeMembershipId,
            dedupeKey: `action.overdue:${action.id}:${action.dueAt.toISOString()}`,
          },
        });
        if (after > before) {
          added += 1;
        }
      }
      return added;
    });
    created += count;
  }
  return created;
}
