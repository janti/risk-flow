import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { Prisma, TenantDatabase, TenantTransaction } from "@riskflow/database";
import {
  loadFormVersionById,
  loadLatestPublishedRiskForm,
  parseCustomValues,
  parseFormSchema,
  parseFormUi,
  type PublishedForm,
  validateCustomValues,
  visibleFieldKeys,
} from "@riskflow/form-engine";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@riskflow/shared";
import { z } from "zod";
import { loadLatestAssessments, riskIdsMatchingCell, type AssessmentSummary } from "./assessments";
import { inOrgUnitScope, visibleOrgUnitFilter } from "./scope";

export const RISK_STATUSES = ["open", "in_progress", "archived"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export type RiskMutationError = "forbidden" | "not_found" | "invalid" | "conflict" | "stale" | "module_disabled";

export type RiskRecord = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  version: number;
  category: { id: string; name: string; code: string };
  orgUnit: { id: string; name: string };
  owner: { id: string; displayName: string; email: string };
  latestInherent: AssessmentSummary | null;
  latestResidual: AssessmentSummary | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customValues: Record<string, unknown>;
  formVersion: PublishedForm | null;
};

export type RiskLookups = {
  categories: { id: string; name: string; code: string }[];
  orgUnits: { id: string; name: string }[];
  owners: { id: string; displayName: string; email: string }[];
  publishedForm: PublishedForm | null;
};

export type RiskListResult = {
  items: RiskRecord[];
  nextCursor: string | null;
  limit: number;
};

export const riskListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  status: z.enum(RISK_STATUSES).optional(),
  categoryId: z.string().uuid().optional(),
  orgUnitId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(["createdAt", "code", "title"]).default("createdAt"),
  assessmentType: z.enum(["inherent", "residual"]).optional(),
  likelihood: z.coerce.number().int().min(1).max(5).optional(),
  impact: z.coerce.number().int().min(1).max(5).optional(),
  createdFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const createRiskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  categoryId: z.string().uuid(),
  orgUnitId: z.string().uuid(),
  ownerId: z.string().uuid(),
  customValues: z.record(z.unknown()).optional(),
});

export const updateRiskSchema = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  categoryId: z.string().uuid().optional(),
  orgUnitId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  status: z.enum(["open", "in_progress"]).optional(),
  customValues: z.record(z.unknown()).optional(),
});

export const archiveRiskSchema = z.object({
  version: z.number().int().positive(),
});

export type RiskListQuery = z.infer<typeof riskListQuerySchema>;
export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;

const riskInclude = {
  category: true,
  orgUnit: true,
  owner: { include: { user: true } },
  formVersion: { include: { definition: true } },
} as const;

type RiskRow = Prisma.RiskGetPayload<{ include: typeof riskInclude }>;

type CursorPayload = {
  sort: RiskListQuery["sort"];
  id: string;
  createdAt?: string;
  code?: string;
  title?: string;
};

function mapBoundForm(row: RiskRow["formVersion"]): PublishedForm | null {
  if (!row) {
    return null;
  }
  const schema = parseFormSchema(row.schemaJson);
  if (!schema) {
    return null;
  }
  return {
    id: row.id,
    definitionId: row.definitionId,
    key: row.definition.key,
    version: row.version,
    schema,
    ui: parseFormUi(row.uiJson, schema),
  };
}

function mapRisk(row: RiskRow, latest?: { inherent: AssessmentSummary | null; residual: AssessmentSummary | null }): RiskRecord {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    status: row.status,
    version: row.version,
    category: { id: row.category.id, name: row.category.name, code: row.category.code },
    orgUnit: { id: row.orgUnit.id, name: row.orgUnit.name },
    owner: {
      id: row.owner.id,
      displayName: row.owner.user.displayName,
      email: row.owner.user.email,
    },
    latestInherent: latest?.inherent ?? null,
    latestResidual: latest?.residual ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    customValues: parseCustomValues(row.customValues),
    formVersion: mapBoundForm(row.formVersion),
  };
}

function snapshot(row: RiskRow): Prisma.InputJsonValue {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    status: row.status,
    version: row.version,
    categoryId: row.categoryId,
    orgUnitId: row.orgUnitId,
    ownerMembershipId: row.ownerMembershipId,
    formVersionId: row.formVersionId,
    customValues: parseCustomValues(row.customValues) as Prisma.InputJsonValue,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

function bindCustomValues(
  form: PublishedForm | null,
  incoming: Record<string, unknown> | undefined,
): { ok: true; values: Record<string, unknown>; formVersionId: string | null } | "invalid" {
  const values = incoming ?? {};
  if (!form) {
    return Object.keys(values).length === 0 ? { ok: true, values: {}, formVersionId: null } : "invalid";
  }
  const visible = visibleFieldKeys(form.schema.fields, values);
  const validated = validateCustomValues(form.schema, values, visible);
  if (!validated.ok) {
    return "invalid";
  }
  return { ok: true, values: validated.values, formVersionId: form.id };
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value: string, sort: RiskListQuery["sort"]): CursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CursorPayload;
    if (parsed.sort !== sort || typeof parsed.id !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function cursorWhere(cursor: CursorPayload, sort: RiskListQuery["sort"]): Prisma.RiskWhereInput {
  if (sort === "code" && cursor.code) {
    return {
      OR: [{ code: { gt: cursor.code } }, { code: cursor.code, id: { gt: cursor.id } }],
    };
  }
  if (sort === "title" && cursor.title) {
    return {
      OR: [{ title: { gt: cursor.title } }, { title: cursor.title, id: { gt: cursor.id } }],
    };
  }
  if (!cursor.createdAt) {
    return { id: { lt: cursor.id } };
  }
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }],
  };
}

function orderBy(sort: RiskListQuery["sort"]): Prisma.RiskOrderByWithRelationInput[] {
  if (sort === "code") {
    return [{ code: "asc" }, { id: "asc" }];
  }
  if (sort === "title") {
    return [{ title: "asc" }, { id: "asc" }];
  }
  return [{ createdAt: "desc" }, { id: "desc" }];
}

async function writeAudit(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    actorUserId: string;
    action: string;
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
      entityType: "risk",
      entityId: input.entityId,
      beforeJson: input.before,
      afterJson: input.after,
      requestId: input.requestId,
    },
  });
}

async function loadRelations(
  tx: TenantTransaction,
  input: { categoryId?: string; orgUnitId?: string; ownerId?: string },
): Promise<"invalid" | { categoryId?: string; orgUnitId?: string; ownerMembershipId?: string }> {
  const result: { categoryId?: string; orgUnitId?: string; ownerMembershipId?: string } = {};
  if (input.categoryId) {
    const category = await tx.riskCategory.findFirst({ where: { id: input.categoryId } });
    if (!category) {
      return "invalid";
    }
    result.categoryId = category.id;
  }
  if (input.orgUnitId) {
    const orgUnit = await tx.orgUnit.findFirst({ where: { id: input.orgUnitId } });
    if (!orgUnit) {
      return "invalid";
    }
    result.orgUnitId = orgUnit.id;
  }
  if (input.ownerId) {
    const owner = await tx.membership.findFirst({
      where: { id: input.ownerId, status: "active" },
    });
    if (!owner) {
      return "invalid";
    }
    result.ownerMembershipId = owner.id;
  }
  return result;
}

async function nextRiskCode(tx: TenantTransaction): Promise<string> {
  const rows = await tx.risk.findMany({ select: { code: true } });
  let max = 0;
  for (const row of rows) {
    const match = /^R-(\d+)$/.exec(row.code);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `R-${String(max + 1).padStart(3, "0")}`;
}

export function parseRiskListQuery(searchParams: URLSearchParams): RiskListQuery | "invalid" {
  const emptyToUndef = (value: string | null) => (value && value.trim().length > 0 ? value : undefined);
  const parsed = riskListQuerySchema.safeParse({
    cursor: emptyToUndef(searchParams.get("cursor")),
    limit: emptyToUndef(searchParams.get("limit")),
    status: emptyToUndef(searchParams.get("status")),
    categoryId: emptyToUndef(searchParams.get("categoryId")),
    orgUnitId: emptyToUndef(searchParams.get("orgUnitId")),
    ownerId: emptyToUndef(searchParams.get("ownerId")),
    q: emptyToUndef(searchParams.get("q")),
    sort: emptyToUndef(searchParams.get("sort")),
    assessmentType: emptyToUndef(searchParams.get("assessmentType")),
    likelihood: emptyToUndef(searchParams.get("likelihood")),
    impact: emptyToUndef(searchParams.get("impact")),
    createdFrom: emptyToUndef(searchParams.get("createdFrom")),
    createdTo: emptyToUndef(searchParams.get("createdTo")),
  });
  if (!parsed.success) {
    return "invalid";
  }
  if ((parsed.data.likelihood === undefined) !== (parsed.data.impact === undefined)) {
    return "invalid";
  }
  if (parsed.data.createdFrom && parsed.data.createdTo && parsed.data.createdFrom > parsed.data.createdTo) {
    return "invalid";
  }
  return parsed.data;
}

export async function listRisks(
  db: TenantDatabase,
  access: TenantAccess,
  query: RiskListQuery,
): Promise<RiskListResult | "forbidden" | "module_disabled"> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  if (query.orgUnitId && !inOrgUnitScope(access, query.orgUnitId)) {
    return { items: [], nextCursor: null, limit: query.limit };
  }

  const cursor = query.cursor ? decodeCursor(query.cursor, query.sort) : undefined;
  if (query.cursor && !cursor) {
    return { items: [], nextCursor: null, limit: query.limit };
  }

  return db.withTenant(access.tenant.id, async (tx) => {
    const baseWhere: Prisma.RiskWhereInput = {
      ...visibleOrgUnitFilter(access),
      ...(query.status ? { status: query.status } : { status: { not: "archived" } }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.orgUnitId ? { orgUnitId: query.orgUnitId } : {}),
      ...(query.ownerId ? { ownerMembershipId: query.ownerId } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(`${query.createdFrom}T00:00:00.000Z`) } : {}),
              ...(query.createdTo ? { lte: new Date(`${query.createdTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { code: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    let matrixIds: string[] | undefined;
    if (query.likelihood !== undefined && query.impact !== undefined) {
      matrixIds = await riskIdsMatchingCell(tx, {
        assessmentType: query.assessmentType ?? "residual",
        likelihood: query.likelihood,
        impact: query.impact,
        riskWhere: baseWhere,
      });
      if (matrixIds.length === 0) {
        return { items: [], nextCursor: null, limit: query.limit };
      }
    }
    const where: Prisma.RiskWhereInput = {
      ...baseWhere,
      ...(matrixIds ? { id: { in: matrixIds } } : {}),
      ...(cursor ? cursorWhere(cursor, query.sort) : {}),
    };

    const rows = await tx.risk.findMany({
      where,
      include: riskInclude,
      orderBy: orderBy(query.sort),
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const latest = await loadLatestAssessments(tx, page.map((row) => row.id));
    const last = page.at(-1);
    return {
      items: page.map((row) => mapRisk(row, latest.get(row.id))),
      nextCursor: hasMore && last
        ? encodeCursor({
            sort: query.sort,
            id: last.id,
            createdAt: last.createdAt.toISOString(),
            code: last.code,
            title: last.title,
          })
        : null,
      limit: query.limit,
    };
  });
}

export async function getRisk(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
): Promise<RiskRecord | "forbidden" | "not_found" | "module_disabled"> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const row = await tx.risk.findFirst({ where: { id: riskId }, include: riskInclude });
    if (!row || !inOrgUnitScope(access, row.orgUnitId)) {
      return "not_found";
    }
    const latest = await loadLatestAssessments(tx, [row.id]);
    return mapRisk(row, latest.get(row.id));
  });
}

export async function getRiskLookups(
  db: TenantDatabase,
  access: TenantAccess,
): Promise<RiskLookups | "forbidden" | "module_disabled"> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const [categories, orgUnits, memberships, publishedForm] = await Promise.all([
      tx.riskCategory.findMany({ orderBy: { name: "asc" } }),
      tx.orgUnit.findMany({ orderBy: { name: "asc" } }),
      tx.membership.findMany({
        where: { status: "active" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      }),
      loadLatestPublishedRiskForm(tx),
    ]);
    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        code: category.code,
      })),
      orgUnits: orgUnits
        .filter((unit) => inOrgUnitScope(access, unit.id))
        .map((unit) => ({ id: unit.id, name: unit.name })),
      owners: memberships.map((membership) => ({
        id: membership.id,
        displayName: membership.user.displayName,
        email: membership.user.email,
      })),
      publishedForm,
    };
  });
}

export async function createRisk(
  db: TenantDatabase,
  access: TenantAccess,
  input: CreateRiskInput,
  requestId?: string,
): Promise<RiskRecord | RiskMutationError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:create", { orgUnitId: input.orgUnitId })) {
    return "forbidden";
  }

  return db.withTenant(access.tenant.id, async (tx) => {
    const relations = await loadRelations(tx, input);
    if (relations === "invalid" || !relations.categoryId || !relations.orgUnitId || !relations.ownerMembershipId) {
      return "invalid";
    }
    const publishedForm = await loadLatestPublishedRiskForm(tx);
    const bound = bindCustomValues(publishedForm, input.customValues);
    if (bound === "invalid") {
      return "invalid";
    }
    const code = await nextRiskCode(tx);
    const row = await tx.risk.create({
      data: {
        tenantId: access.tenant.id,
        code,
        title: input.title,
        description: input.description || null,
        categoryId: relations.categoryId,
        orgUnitId: relations.orgUnitId,
        ownerMembershipId: relations.ownerMembershipId,
        status: "open",
        customValues: bound.values as Prisma.InputJsonValue,
        formVersionId: bound.formVersionId,
        createdBy: access.membership.id,
        updatedBy: access.membership.id,
      },
      include: riskInclude,
    });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "risk.create",
      entityId: row.id,
      after: snapshot(row),
      requestId,
    });
    return mapRisk(row);
  });
}

export async function updateRisk(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
  input: UpdateRiskInput,
  requestId?: string,
): Promise<RiskRecord | RiskMutationError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:update")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const existing = await tx.risk.findFirst({ where: { id: riskId }, include: riskInclude });
    if (!existing || !inOrgUnitScope(access, existing.orgUnitId)) {
      return "not_found";
    }
    const nextOrgUnitId = input.orgUnitId ?? existing.orgUnitId;
    if (!authorize(access, "risk:update", { orgUnitId: nextOrgUnitId })) {
      return "forbidden";
    }
    if (existing.archivedAt) {
      return "conflict";
    }

    const relations = await loadRelations(tx, {
      categoryId: input.categoryId,
      orgUnitId: input.orgUnitId,
      ownerId: input.ownerId,
    });
    if (relations === "invalid") {
      return "invalid";
    }

    let customValues: Prisma.InputJsonValue | undefined;
    if (input.customValues !== undefined) {
      const boundForm = existing.formVersionId
        ? await loadFormVersionById(tx, existing.formVersionId)
        : null;
      const bound = bindCustomValues(boundForm, input.customValues);
      if (bound === "invalid") {
        return "invalid";
      }
      customValues = bound.values as Prisma.InputJsonValue;
    }

    const result = await tx.risk.updateMany({
      where: { id: riskId, version: input.version },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(relations.categoryId ? { categoryId: relations.categoryId } : {}),
        ...(relations.orgUnitId ? { orgUnitId: relations.orgUnitId } : {}),
        ...(relations.ownerMembershipId ? { ownerMembershipId: relations.ownerMembershipId } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(customValues !== undefined ? { customValues } : {}),
        version: input.version + 1,
        updatedAt: new Date(),
        updatedBy: access.membership.id,
      },
    });
    if (result.count === 0) {
      return "stale";
    }

    const updated = await tx.risk.findFirstOrThrow({ where: { id: riskId }, include: riskInclude });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "risk.update",
      entityId: updated.id,
      before: snapshot(existing),
      after: snapshot(updated),
      requestId,
    });
    return mapRisk(updated);
  });
}

export async function archiveRisk(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
  input: { version: number },
  requestId?: string,
): Promise<RiskRecord | RiskMutationError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:archive")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const existing = await tx.risk.findFirst({ where: { id: riskId }, include: riskInclude });
    if (!existing || !inOrgUnitScope(access, existing.orgUnitId)) {
      return "not_found";
    }
    if (!authorize(access, "risk:archive", { orgUnitId: existing.orgUnitId })) {
      return "forbidden";
    }
    if (existing.archivedAt) {
      return "conflict";
    }

    const result = await tx.risk.updateMany({
      where: { id: riskId, version: input.version },
      data: {
        status: "archived",
        archivedAt: new Date(),
        version: input.version + 1,
        updatedAt: new Date(),
        updatedBy: access.membership.id,
      },
    });
    if (result.count === 0) {
      return "stale";
    }

    const updated = await tx.risk.findFirstOrThrow({ where: { id: riskId }, include: riskInclude });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "risk.archive",
      entityId: updated.id,
      before: snapshot(existing),
      after: snapshot(updated),
      requestId,
    });
    return mapRisk(updated);
  });
}
