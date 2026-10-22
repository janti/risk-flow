import { hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { Prisma, TenantDatabase, TenantTransaction } from "@riskflow/database";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@riskflow/shared";
import { z } from "zod";

export type NotificationError = "forbidden" | "not_found" | "module_disabled";

export type NotificationRecord = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export const notificationListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  unread: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export function parseNotificationListQuery(searchParams: URLSearchParams): NotificationListQuery | "invalid" {
  const parsed = notificationListQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    unread: searchParams.get("unread") ?? undefined,
  });
  return parsed.success ? parsed.data : "invalid";
}

export type NotificationListResult = {
  items: NotificationRecord[];
  unreadCount: number;
  nextCursor: string | null;
  limit: number;
};

function mapNotification(row: {
  id: string;
  type: string;
  payloadJson: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRecord {
  return {
    id: row.id,
    type: row.type,
    payload: (row.payloadJson ?? {}) as Record<string, unknown>,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function upsertNotification(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    membershipId: string;
    type: string;
    dedupeKey: string;
    payload: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.notification.upsert({
    where: {
      tenantId_membershipId_dedupeKey: {
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        dedupeKey: input.dedupeKey,
      },
    },
    create: {
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      type: input.type,
      dedupeKey: input.dedupeKey,
      payloadJson: input.payload,
    },
    update: {},
  });
}

export async function listNotifications(
  db: TenantDatabase,
  access: TenantAccess,
  query: NotificationListQuery,
): Promise<NotificationListResult | NotificationError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const where = {
      membershipId: access.membership.id,
      ...(query.unread ? { readAt: null } : {}),
    };
    const unreadCount = await tx.notification.count({
      where: { membershipId: access.membership.id, readAt: null },
    });
    const rows = await tx.notification.findMany({
      where: {
        ...where,
        ...(query.cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(query.cursor) } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map(mapNotification),
      unreadCount,
      nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
      limit: query.limit,
    };
  });
}

export async function markNotificationRead(
  db: TenantDatabase,
  access: TenantAccess,
  notificationId: string,
  now = new Date(),
): Promise<NotificationRecord | NotificationError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const existing = await tx.notification.findFirst({
      where: { id: notificationId, membershipId: access.membership.id },
    });
    if (!existing) {
      return "not_found";
    }
    if (existing.readAt) {
      return mapNotification(existing);
    }
    const updated = await tx.notification.update({
      where: { id: existing.id },
      data: { readAt: now },
    });
    return mapNotification(updated);
  });
}
