import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { Prisma, TenantDatabase, TenantTransaction } from "@riskflow/database";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@riskflow/shared";
import { z } from "zod";
import { writeAudit, writeOutbox } from "./outbox";
import { inOrgUnitScope, visibleOrgUnitFilter } from "./scope";

export const ACTION_STATUSES = ["open", "in_progress", "completed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export type ActionError = "forbidden" | "not_found" | "invalid" | "conflict" | "module_disabled";

export type ActionRecord = {
  id: string;
  riskId: string;
  riskCode: string;
  riskTitle: string;
  title: string;
  description: string | null;
  status: ActionStatus;
  dueAt: string;
  completedAt: string | null;
  overdue: boolean;
  assignee: { id: string; displayName: string; email: string };
  createdAt: string;
  updatedAt: string;
};

export type ActionListResult = {
  items: ActionRecord[];
  nextCursor: string | null;
  limit: number;
};

export const actionListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  status: z.enum(ACTION_STATUSES).optional(),
  mine: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  overdue: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  riskId: z.string().uuid().optional(),
});

const dueAtSchema = z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid due date",
});

export const createActionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  assigneeMembershipId: z.string().uuid(),
  dueAt: dueAtSchema,
});

export const updateActionSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    assigneeMembershipId: z.string().uuid().optional(),
    dueAt: dueAtSchema.optional(),
    status: z.enum(ACTION_STATUSES).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "No fields to update",
  });

export type ActionListQuery = z.infer<typeof actionListQuerySchema>;
export type CreateActionInput = z.infer<typeof createActionSchema>;
export type UpdateActionInput = z.infer<typeof updateActionSchema>;

const actionInclude = {
  assignee: { include: { user: true } },
  risk: true,
} as const;

type ActionRow = Prisma.RiskActionGetPayload<{ include: typeof actionInclude }>;

function isOverdue(row: { dueAt: Date; status: string; completedAt: Date | null }, now = new Date()): boolean {
  return row.status !== "completed" && row.completedAt === null && row.dueAt.getTime() < now.getTime();
}

function mapAction(row: ActionRow, now = new Date()): ActionRecord {
  return {
    id: row.id,
    riskId: row.riskId,
    riskCode: row.risk.code,
    riskTitle: row.risk.title,
    title: row.title,
    description: row.description,
    status: row.status as ActionStatus,
    dueAt: row.dueAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    overdue: isOverdue(row, now),
    assignee: {
      id: row.assignee.id,
      displayName: row.assignee.user.displayName,
      email: row.assignee.user.email,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function decodeCursor(value: string): { createdAt: string; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };
    if (!parsed.createdAt || !parsed.id) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }), "utf8").toString(
    "base64url",
  );
}

export function parseActionListQuery(searchParams: URLSearchParams): ActionListQuery | "invalid" {
  const emptyToUndef = (value: string | null) => (value && value.trim().length > 0 ? value : undefined);
  const parsed = actionListQuerySchema.safeParse({
    cursor: emptyToUndef(searchParams.get("cursor")),
    limit: emptyToUndef(searchParams.get("limit")),
    status: emptyToUndef(searchParams.get("status")),
    mine: emptyToUndef(searchParams.get("mine")),
    overdue: emptyToUndef(searchParams.get("overdue")),
    riskId: emptyToUndef(searchParams.get("riskId")),
  });
  return parsed.success ? parsed.data : "invalid";
}

async function loadVisibleRisk(tx: TenantTransaction, access: TenantAccess, riskId: string) {
  const risk = await tx.risk.findFirst({ where: { id: riskId } });
  if (!risk || !inOrgUnitScope(access, risk.orgUnitId)) {
    return null;
  }
  return risk;
}

export async function listActions(
  db: TenantDatabase,
  access: TenantAccess,
  query: ActionListQuery,
): Promise<ActionListResult | ActionError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
  if (query.cursor && !cursor) {
    return { items: [], nextCursor: null, limit: query.limit };
  }
  const now = new Date();
  return db.withTenant(access.tenant.id, async (tx) => {
    if (query.riskId) {
      const risk = await loadVisibleRisk(tx, access, query.riskId);
      if (!risk) {
        return "not_found";
      }
    }
    const where: Prisma.RiskActionWhereInput = {
      risk: visibleOrgUnitFilter(access),
      ...(query.riskId ? { riskId: query.riskId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.mine ? { assigneeMembershipId: access.membership.id } : {}),
      ...(query.overdue
        ? { status: { not: "completed" }, dueAt: { lt: now } }
        : {}),
    };
    const rows = await tx.riskAction.findMany({
      where: cursor
        ? {
            AND: [
              where,
              {
                OR: [
                  { createdAt: { lt: new Date(cursor.createdAt) } },
                  { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
                ],
              },
            ],
          }
        : where,
      include: actionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => mapAction(row, now)),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
      limit: query.limit,
    };
  });
}

export async function createAction(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
  input: CreateActionInput,
  requestId?: string,
): Promise<ActionRecord | ActionError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "action:assign")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const risk = await loadVisibleRisk(tx, access, riskId);
    if (!risk) {
      return "not_found";
    }
    if (!authorize(access, "action:assign", { orgUnitId: risk.orgUnitId })) {
      return "forbidden";
    }
    const assignee = await tx.membership.findFirst({
      where: { id: input.assigneeMembershipId, status: "active" },
    });
    if (!assignee) {
      return "invalid";
    }
    const created = await tx.riskAction.create({
      data: {
        tenantId: access.tenant.id,
        riskId,
        title: input.title,
        description: input.description,
        assigneeMembershipId: assignee.id,
        dueAt: new Date(input.dueAt),
        status: "open",
        createdBy: access.user.id,
        updatedBy: access.user.id,
      },
      include: actionInclude,
    });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "action.create",
      entityType: "action",
      entityId: created.id,
      after: { riskId, title: created.title, assigneeMembershipId: created.assigneeMembershipId, dueAt: created.dueAt.toISOString() },
      requestId,
    });
    await writeOutbox(tx, {
      tenantId: access.tenant.id,
      type: "action.assigned",
      payload: { actionId: created.id, riskId, assigneeMembershipId: created.assigneeMembershipId },
    });
    return mapAction(created);
  });
}

export async function updateAction(
  db: TenantDatabase,
  access: TenantAccess,
  actionId: string,
  input: UpdateActionInput,
  requestId?: string,
): Promise<ActionRecord | ActionError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  const completing = input.status === "completed";
  const needed = completing ? "action:complete" : "action:assign";
  if (!authorize(access, needed)) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const existing = await tx.riskAction.findFirst({
      where: { id: actionId },
      include: actionInclude,
    });
    if (!existing || !inOrgUnitScope(access, existing.risk.orgUnitId)) {
      return "not_found";
    }
    if (!authorize(access, needed, { orgUnitId: existing.risk.orgUnitId })) {
      return "forbidden";
    }
    if (existing.status === "completed") {
      return "conflict";
    }

    let assigneeMembershipId = existing.assigneeMembershipId;
    if (input.assigneeMembershipId) {
      const assignee = await tx.membership.findFirst({
        where: { id: input.assigneeMembershipId, status: "active" },
      });
      if (!assignee) {
        return "invalid";
      }
      assigneeMembershipId = assignee.id;
    }

    const nextStatus = input.status ?? existing.status;
    const completedAt = nextStatus === "completed" ? new Date() : null;
    const updated = await tx.riskAction.update({
      where: { id: existing.id },
      data: {
        title: input.title ?? existing.title,
        description: input.description === undefined ? existing.description : input.description,
        assigneeMembershipId,
        dueAt: input.dueAt ? new Date(input.dueAt) : existing.dueAt,
        status: nextStatus,
        completedAt,
        updatedBy: access.user.id,
      },
      include: actionInclude,
    });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: completing ? "action.complete" : "action.update",
      entityType: "action",
      entityId: updated.id,
      before: { status: existing.status, assigneeMembershipId: existing.assigneeMembershipId },
      after: { status: updated.status, assigneeMembershipId: updated.assigneeMembershipId },
      requestId,
    });
    await writeOutbox(tx, {
      tenantId: access.tenant.id,
      type: completing ? "action.completed" : "action.updated",
      payload: { actionId: updated.id, riskId: updated.riskId, status: updated.status },
    });
    return mapAction(updated);
  });
}
