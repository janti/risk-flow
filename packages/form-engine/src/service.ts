import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { Prisma, TenantDatabase, TenantTransaction } from "@riskflow/database";
import { countAffectedRecords, diffFormSchemas, type MigrationImpact } from "./impact";
import {
  EMPTY_FORM_SCHEMA,
  EMPTY_FORM_UI,
  parseCustomValues,
  parseFormSchema,
  parseFormUi,
  type CreateFormBody,
  type FormSchema,
  type FormUi,
  type FormVersionStatus,
} from "./schema";

export type FormError = "forbidden" | "not_found" | "invalid" | "conflict" | "module_disabled";

export type FormVersionRecord = {
  id: string;
  definitionId: string;
  version: number;
  status: FormVersionStatus;
  schema: FormSchema;
  ui: FormUi;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FormDefinitionRecord = {
  id: string;
  key: string;
  name: string;
  targetEntity: string;
  createdAt: string;
  updatedAt: string;
  latestPublishedVersion: number | null;
  draftVersion: number | null;
  versions: FormVersionRecord[];
};

export type PublishedForm = {
  id: string;
  definitionId: string;
  key: string;
  version: number;
  schema: FormSchema;
  ui: FormUi;
};

type VersionRow = {
  id: string;
  definitionId: string;
  version: number;
  status: string;
  schemaJson: Prisma.JsonValue;
  uiJson: Prisma.JsonValue;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapVersion(row: VersionRow): FormVersionRecord | null {
  const schema = parseFormSchema(row.schemaJson);
  if (!schema) {
    return null;
  }
  if (row.status !== "draft" && row.status !== "published") {
    return null;
  }
  return {
    id: row.id,
    definitionId: row.definitionId,
    version: row.version,
    status: row.status,
    schema,
    ui: parseFormUi(row.uiJson, schema),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapDefinition(row: {
  id: string;
  key: string;
  name: string;
  targetEntity: string;
  createdAt: Date;
  updatedAt: Date;
  versions: VersionRow[];
}): FormDefinitionRecord {
  const versions = row.versions
    .map(mapVersion)
    .filter((version): version is FormVersionRecord => version !== null)
    .sort((a, b) => b.version - a.version);
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    targetEntity: row.targetEntity,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    latestPublishedVersion: versions.find((version) => version.status === "published")?.version ?? null,
    draftVersion: versions.find((version) => version.status === "draft")?.version ?? null,
    versions,
  };
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
      entityType: "form",
      entityId: input.entityId,
      beforeJson: input.before,
      afterJson: input.after,
      requestId: input.requestId,
    },
  });
}

function jsonSchema(schema: FormSchema): Prisma.InputJsonValue {
  return schema as unknown as Prisma.InputJsonValue;
}

function jsonUi(ui: FormUi): Prisma.InputJsonValue {
  return ui as unknown as Prisma.InputJsonValue;
}

export async function listForms(
  db: TenantDatabase,
  access: TenantAccess,
): Promise<FormDefinitionRecord[] | "forbidden" | "module_disabled"> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "form:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const rows = await tx.formDefinition.findMany({
      include: { versions: { orderBy: { version: "desc" } } },
      orderBy: { key: "asc" },
    });
    return rows.map(mapDefinition);
  });
}

export async function getForm(
  db: TenantDatabase,
  access: TenantAccess,
  formId: string,
): Promise<FormDefinitionRecord | "forbidden" | "not_found" | "module_disabled"> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "form:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const row = await tx.formDefinition.findFirst({
      where: { id: formId },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    return row ? mapDefinition(row) : "not_found";
  });
}

export async function createForm(
  db: TenantDatabase,
  access: TenantAccess,
  input: CreateFormBody,
  requestId?: string,
): Promise<FormDefinitionRecord | FormError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "form:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const existing = await tx.formDefinition.findFirst({ where: { key: input.key } });
    if (existing) {
      return "conflict";
    }
    const definition = await tx.formDefinition.create({
      data: {
        tenantId: access.tenant.id,
        key: input.key,
        name: input.name,
        targetEntity: input.targetEntity,
        createdBy: access.membership.id,
        updatedBy: access.membership.id,
      },
    });
    await tx.formVersion.create({
      data: {
        tenantId: access.tenant.id,
        definitionId: definition.id,
        version: 1,
        schemaJson: jsonSchema(EMPTY_FORM_SCHEMA),
        uiJson: jsonUi(EMPTY_FORM_UI),
        status: "draft",
        createdBy: access.membership.id,
        updatedBy: access.membership.id,
      },
    });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "form.create",
      entityId: definition.id,
      after: { key: definition.key, name: definition.name },
      requestId,
    });
    const row = await tx.formDefinition.findFirstOrThrow({
      where: { id: definition.id },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    return mapDefinition(row);
  });
}

export async function listFormVersions(
  db: TenantDatabase,
  access: TenantAccess,
  formId: string,
): Promise<FormVersionRecord[] | "forbidden" | "not_found" | "module_disabled"> {
  const form = await getForm(db, access, formId);
  if (typeof form === "string") {
    return form;
  }
  return form.versions;
}

export async function createFormVersion(
  db: TenantDatabase,
  access: TenantAccess,
  formId: string,
  input: { fromVersion?: number },
  requestId?: string,
): Promise<FormVersionRecord | FormError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "form:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const definition = await tx.formDefinition.findFirst({
      where: { id: formId },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    if (!definition) {
      return "not_found";
    }
    const existingDraft = definition.versions.find((version) => version.status === "draft");
    if (existingDraft) {
      return mapVersion(existingDraft) ?? "invalid";
    }
    const source =
      (input.fromVersion
        ? definition.versions.find((version) => version.version === input.fromVersion)
        : definition.versions.find((version) => version.status === "published")) ?? definition.versions[0];
    const schema = source ? parseFormSchema(source.schemaJson) ?? EMPTY_FORM_SCHEMA : EMPTY_FORM_SCHEMA;
    const ui = source ? parseFormUi(source.uiJson, schema) : EMPTY_FORM_UI;
    const nextVersion = (definition.versions[0]?.version ?? 0) + 1;
    try {
      const created = await tx.formVersion.create({
        data: {
          tenantId: access.tenant.id,
          definitionId: definition.id,
          version: nextVersion,
          schemaJson: jsonSchema(schema),
          uiJson: jsonUi(ui),
          status: "draft",
          createdBy: access.membership.id,
          updatedBy: access.membership.id,
        },
      });
      await writeAudit(tx, {
        tenantId: access.tenant.id,
        actorUserId: access.user.id,
        action: "form.version.create",
        entityId: created.id,
        after: { definitionId: definition.id, version: nextVersion },
        requestId,
      });
      return mapVersion(created) ?? "invalid";
    } catch (error) {
      if (!isPrismaCode(error, "P2002")) {
        throw error;
      }
      const raced = await tx.formVersion.findFirst({
        where: { definitionId: definition.id, status: "draft" },
      });
      return raced ? mapVersion(raced) ?? "invalid" : "conflict";
    }
  });
}

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === code;
}

export async function saveFormDraft(
  db: TenantDatabase,
  access: TenantAccess,
  formId: string,
  versionNumber: number,
  input: { schema: FormSchema; ui?: FormUi },
  requestId?: string,
): Promise<FormVersionRecord | FormError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "form:manage")) {
    return "forbidden";
  }
  const ui = parseFormUi(input.ui ?? EMPTY_FORM_UI, input.schema);
  return db.withTenant(access.tenant.id, async (tx) => {
    const existing = await tx.formVersion.findFirst({
      where: { definitionId: formId, version: versionNumber },
    });
    if (!existing) {
      return "not_found";
    }
    if (existing.status !== "draft") {
      return "conflict";
    }
    const result = await tx.formVersion.updateMany({
      where: { id: existing.id, status: "draft" },
      data: {
        schemaJson: jsonSchema(input.schema),
        uiJson: jsonUi(ui),
        updatedBy: access.membership.id,
      },
    });
    if (result.count === 0) {
      return "conflict";
    }
    const updated = await tx.formVersion.findFirstOrThrow({ where: { id: existing.id } });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "form.version.save",
      entityId: updated.id,
      before: { version: existing.version, status: existing.status },
      after: { version: updated.version, status: updated.status, fieldCount: input.schema.fields.length },
      requestId,
    });
    return mapVersion(updated) ?? "invalid";
  });
}

async function loadImpact(
  tx: TenantTransaction,
  definitionId: string,
  previous: FormSchema | null,
  next: FormSchema,
): Promise<MigrationImpact> {
  const diff = diffFormSchemas(previous, next);
  const publishedIds = (
    await tx.formVersion.findMany({
      where: { definitionId, status: "published" },
      select: { id: true },
    })
  ).map((row) => row.id);
  if (publishedIds.length === 0 || diff.removedKeys.length === 0) {
    return { ...diff, affectedRecordCount: 0 };
  }
  const risks = await tx.risk.findMany({
    where: { formVersionId: { in: publishedIds } },
    select: { customValues: true },
  });
  return {
    ...diff,
    affectedRecordCount: countAffectedRecords(
      diff.removedKeys,
      risks.map((risk) => ({ customValues: parseCustomValues(risk.customValues) })),
    ),
  };
}

export async function previewFormImpact(
  db: TenantDatabase,
  access: TenantAccess,
  formId: string,
  versionNumber: number,
): Promise<{ version: FormVersionRecord; impact: MigrationImpact } | FormError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "form:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const current = await tx.formVersion.findFirst({
      where: { definitionId: formId, version: versionNumber },
    });
    if (!current) {
      return "not_found";
    }
    const mapped = mapVersion(current);
    if (!mapped) {
      return "invalid";
    }
    const previous = await tx.formVersion.findFirst({
      where: { definitionId: formId, status: "published" },
      orderBy: { version: "desc" },
    });
    const previousSchema = previous ? parseFormSchema(previous.schemaJson) : null;
    return {
      version: mapped,
      impact: await loadImpact(tx, formId, previousSchema, mapped.schema),
    };
  });
}

export async function publishFormVersion(
  db: TenantDatabase,
  access: TenantAccess,
  formId: string,
  versionNumber: number,
  requestId?: string,
): Promise<{ version: FormVersionRecord; impact: MigrationImpact } | FormError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "form:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const current = await tx.formVersion.findFirst({
      where: { definitionId: formId, version: versionNumber },
    });
    if (!current) {
      return "not_found";
    }
    if (current.status !== "draft") {
      return "conflict";
    }
    const mapped = mapVersion(current);
    if (!mapped) {
      return "invalid";
    }
    const previous = await tx.formVersion.findFirst({
      where: { definitionId: formId, status: "published" },
      orderBy: { version: "desc" },
    });
    const previousSchema = previous ? parseFormSchema(previous.schemaJson) : null;
    const impact = await loadImpact(tx, formId, previousSchema, mapped.schema);
    const publishedAt = new Date();
    const result = await tx.formVersion.updateMany({
      where: { id: current.id, status: "draft" },
      data: {
        status: "published",
        publishedAt,
        updatedBy: access.membership.id,
      },
    });
    if (result.count === 0) {
      return "conflict";
    }
    const updated = await tx.formVersion.findFirstOrThrow({ where: { id: current.id } });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "form.publish",
      entityId: updated.id,
      before: { version: current.version, status: current.status },
      after: { version: updated.version, status: updated.status, impact },
      requestId,
    });
    const published = mapVersion(updated);
    if (!published) {
      return "invalid";
    }
    return { version: published, impact };
  });
}

export async function loadLatestPublishedRiskForm(
  tx: TenantTransaction,
): Promise<PublishedForm | null> {
  const row = await tx.formVersion.findFirst({
    where: { status: "published", definition: { targetEntity: "risk" } },
    include: { definition: true },
    orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
  });
  if (!row) {
    return null;
  }
  const mapped = mapVersion(row);
  if (!mapped) {
    return null;
  }
  return {
    id: mapped.id,
    definitionId: mapped.definitionId,
    key: row.definition.key,
    version: mapped.version,
    schema: mapped.schema,
    ui: mapped.ui,
  };
}

export async function loadFormVersionById(
  tx: TenantTransaction,
  formVersionId: string,
): Promise<PublishedForm | null> {
  const row = await tx.formVersion.findFirst({
    where: { id: formVersionId },
    include: { definition: true },
  });
  if (!row) {
    return null;
  }
  const mapped = mapVersion(row);
  if (!mapped) {
    return null;
  }
  return {
    id: mapped.id,
    definitionId: mapped.definitionId,
    key: row.definition.key,
    version: mapped.version,
    schema: mapped.schema,
    ui: mapped.ui,
  };
}
