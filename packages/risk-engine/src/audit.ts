import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { Prisma, TenantDatabase } from "@riskflow/database";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@riskflow/shared";
import { z } from "zod";

export type AuditError = "forbidden" | "module_disabled" | "invalid";

export type AuditEventRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  actorName: string | null;
  occurredAt: string;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  requestId: string | null;
};

export const auditListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

export type AuditListResult = {
  items: AuditEventRecord[];
  nextCursor: string | null;
  limit: number;
};

export function parseAuditListQuery(searchParams: URLSearchParams): AuditListQuery | "invalid" {
  const parsed = auditListQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  return parsed.success ? parsed.data : "invalid";
}

export async function listAuditEvents(
  db: TenantDatabase,
  access: TenantAccess,
  query: AuditListQuery,
): Promise<AuditListResult | AuditError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "audit:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const rows = await tx.auditEvent.findMany({
      where: query.cursor ? { occurredAt: { lt: new Date(query.cursor) } } : undefined,
      include: { actor: true },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorUserId: row.actorUserId,
        actorName: row.actor?.displayName ?? null,
        occurredAt: row.occurredAt.toISOString(),
        before: row.beforeJson,
        after: row.afterJson,
        requestId: row.requestId,
      })),
      nextCursor: hasMore && last ? last.occurredAt.toISOString() : null,
      limit: query.limit,
    };
  });
}
