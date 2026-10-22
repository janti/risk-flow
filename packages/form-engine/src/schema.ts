import { z } from "zod";

export const FORM_FIELD_TYPES = [
  "shortText",
  "longText",
  "number",
  "date",
  "select",
  "multiSelect",
  "boolean",
  "user",
  "orgUnit",
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_TARGET_ENTITIES = ["risk"] as const;
export type FormTargetEntity = (typeof FORM_TARGET_ENTITIES)[number];

export const FORM_VERSION_STATUSES = ["draft", "published"] as const;
export type FormVersionStatus = (typeof FORM_VERSION_STATUSES)[number];

export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SCRIPT_PATTERN = /function\s*\(|=>\s*|eval\s*\(|new\s+Function|javascript:/i;

export type ConditionAst =
  | { op: "and" | "or"; children: ConditionAst[] }
  | { op: "not"; child: ConditionAst }
  | { op: "equals" | "in" | "greaterThan"; field: string; value?: unknown };

export type FormField = {
  id: string;
  key: string;
  type: FormFieldType;
  label: string;
  helpText?: string;
  required: boolean;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  validation?: { min?: number; max?: number; maxLength?: number };
  visibility?: ConditionAst;
};

export type FormSchema = {
  fields: FormField[];
};

export type FormUi = {
  fieldOrder: string[];
};

const fieldKeySchema = z.string().regex(FIELD_KEY_PATTERN);

const conditionAstSchema: z.ZodType<ConditionAst> = z.lazy(() =>
  z.union([
    z
      .object({
        op: z.enum(["and", "or"]),
        children: z.array(conditionAstSchema).min(1).max(16),
      })
      .strict(),
    z
      .object({
        op: z.literal("not"),
        child: conditionAstSchema,
      })
      .strict(),
    z
      .object({
        op: z.enum(["equals", "in", "greaterThan"]),
        field: fieldKeySchema,
        value: z.any(),
      })
      .strict(),
  ]),
);

const optionSchema = z
  .object({
    value: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(200),
  })
  .strict();

const fieldSchema: z.ZodType<FormField> = z
  .object({
    id: z.string().uuid(),
    key: fieldKeySchema,
    type: z.enum(FORM_FIELD_TYPES),
    label: z.string().trim().min(1).max(200),
    helpText: z.string().trim().max(1000).optional(),
    required: z.boolean(),
    defaultValue: z.unknown().optional(),
    options: z.array(optionSchema).max(100).optional(),
    validation: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
        maxLength: z.number().int().positive().max(10_000).optional(),
      })
      .strict()
      .optional(),
    visibility: conditionAstSchema.optional(),
  })
  .strict()
  .superRefine((field, ctx) => {
    if ((field.type === "select" || field.type === "multiSelect") && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choice fields require options.",
        path: ["options"],
      });
    }
  });

export const formSchemaSchema = z
  .object({
    fields: z.array(fieldSchema).max(100),
  })
  .strict()
  .superRefine((schema, ctx) => {
    const keys = new Set<string>();
    const ids = new Set<string>();
    for (const [index, field] of schema.fields.entries()) {
      if (keys.has(field.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field key ${field.key}.`,
          path: ["fields", index, "key"],
        });
      }
      keys.add(field.key);
      if (ids.has(field.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field id ${field.id}.`,
          path: ["fields", index, "id"],
        });
      }
      ids.add(field.id);
    }
  });

export const formUiSchema = z
  .object({
    fieldOrder: z.array(z.string().uuid()).max(100),
  })
  .strict();

export const createFormBodySchema = z.object({
  key: fieldKeySchema,
  name: z.string().trim().min(1).max(200),
  targetEntity: z.enum(FORM_TARGET_ENTITIES).default("risk"),
});

export const saveDraftBodySchema = z.object({
  schema: formSchemaSchema,
  ui: formUiSchema.optional(),
});

export const createVersionBodySchema = z.object({
  fromVersion: z.number().int().positive().optional(),
});

export type CreateFormBody = z.infer<typeof createFormBodySchema>;
export type SaveDraftBody = z.infer<typeof saveDraftBodySchema>;
export type CreateVersionBody = z.infer<typeof createVersionBodySchema>;

export const EMPTY_FORM_SCHEMA: FormSchema = { fields: [] };
export const EMPTY_FORM_UI: FormUi = { fieldOrder: [] };

export function containsForbiddenScript(value: unknown): boolean {
  if (typeof value === "string") {
    return SCRIPT_PATTERN.test(value);
  }
  if (typeof value === "function") {
    return true;
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(containsForbiddenScript);
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return true;
    }
    if (containsForbiddenScript(nested)) {
      return true;
    }
  }
  return false;
}

/**
 * Conditional rules are AST expressions only. Arbitrary executable code is rejected.
 */
export function isConditionAst(value: unknown, depth = 0): value is ConditionAst {
  if (depth > 8 || typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const op = record.op;
  if (op === "and" || op === "or") {
    return (
      keys.length === 2 &&
      Array.isArray(record.children) &&
      record.children.length > 0 &&
      record.children.every((child) => isConditionAst(child, depth + 1))
    );
  }
  if (op === "not") {
    return keys.length === 2 && isConditionAst(record.child, depth + 1);
  }
  if (op === "equals" || op === "in" || op === "greaterThan") {
    return keys.length === 3 && typeof record.field === "string" && FIELD_KEY_PATTERN.test(record.field);
  }
  return false;
}

export function parseFormSchema(value: unknown): FormSchema | null {
  if (containsForbiddenScript(value)) {
    return null;
  }
  const parsed = formSchemaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseFormUi(value: unknown, schema: FormSchema): FormUi {
  const parsed = formUiSchema.safeParse(value);
  const knownIds = new Set(schema.fields.map((field) => field.id));
  const order = parsed.success
    ? parsed.data.fieldOrder.filter((id) => knownIds.has(id))
    : [];
  for (const field of schema.fields) {
    if (!order.includes(field.id)) {
      order.push(field.id);
    }
  }
  return { fieldOrder: order };
}

export function orderedFields(schema: FormSchema, ui: FormUi): FormField[] {
  const byId = new Map(schema.fields.map((field) => [field.id, field]));
  const ordered: FormField[] = [];
  for (const id of ui.fieldOrder) {
    const field = byId.get(id);
    if (field) {
      ordered.push(field);
      byId.delete(id);
    }
  }
  ordered.push(...byId.values());
  return ordered;
}

export function parseCustomValues(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function optionValues(field: FormField): Set<string> {
  return new Set((field.options ?? []).map((option) => option.value));
}

export function validateFieldValue(field: FormField, raw: unknown): unknown | "invalid" {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  switch (field.type) {
    case "shortText": {
      if (typeof raw !== "string") {
        return "invalid";
      }
      const max = field.validation?.maxLength ?? 500;
      const trimmed = raw.trim();
      return trimmed.length > 0 && trimmed.length <= max ? trimmed : "invalid";
    }
    case "longText": {
      if (typeof raw !== "string") {
        return "invalid";
      }
      const max = field.validation?.maxLength ?? 4000;
      return raw.length <= max ? raw : "invalid";
    }
    case "number": {
      const number = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
      if (!Number.isFinite(number)) {
        return "invalid";
      }
      if (field.validation?.min !== undefined && number < field.validation.min) {
        return "invalid";
      }
      if (field.validation?.max !== undefined && number > field.validation.max) {
        return "invalid";
      }
      return number;
    }
    case "date":
      return typeof raw === "string" && DATE_PATTERN.test(raw) ? raw : "invalid";
    case "select":
      return typeof raw === "string" && optionValues(field).has(raw) ? raw : "invalid";
    case "multiSelect": {
      if (!Array.isArray(raw)) {
        return "invalid";
      }
      const allowed = optionValues(field);
      if (!raw.every((item) => typeof item === "string" && allowed.has(item))) {
        return "invalid";
      }
      return raw;
    }
    case "boolean":
      return typeof raw === "boolean" ? raw : "invalid";
    case "user":
    case "orgUnit":
      return isUuid(raw) ? raw : "invalid";
    default:
      return "invalid";
  }
}

export type CustomValueError = { key: string; reason: "unknown" | "required" | "invalid" };

export function validateCustomValues(
  schema: FormSchema,
  values: Record<string, unknown>,
  visibleKeys: Set<string>,
): { ok: true; values: Record<string, unknown> } | { ok: false; errors: CustomValueError[] } {
  const errors: CustomValueError[] = [];
  const cleaned: Record<string, unknown> = {};
  const byKey = new Map(schema.fields.map((field) => [field.key, field]));

  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) {
      errors.push({ key, reason: "unknown" });
    }
  }

  for (const field of schema.fields) {
    const visible = visibleKeys.has(field.key);
    const parsed = validateFieldValue(field, values[field.key]);
    if (parsed === "invalid") {
      errors.push({ key: field.key, reason: "invalid" });
      continue;
    }
    if (parsed === undefined) {
      if (visible && field.required) {
        errors.push({ key: field.key, reason: "required" });
      }
      continue;
    }
    if (visible) {
      cleaned[field.key] = parsed;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, values: cleaned };
}
