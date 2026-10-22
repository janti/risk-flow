import type { Prisma, TenantTransaction } from "@riskflow/database";

export async function writeOutbox(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    type: string;
    payload: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      payloadJson: input.payload,
    },
  });
}

export async function writeAudit(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    requestId?: string;
  },
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.before,
      afterJson: input.after,
      requestId: input.requestId,
    },
  });
}
