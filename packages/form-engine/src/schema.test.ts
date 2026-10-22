import { describe, expect, it } from "vitest";
import { evaluateCondition, visibleFieldKeys } from "./ast";
import { countAffectedRecords, diffFormSchemas } from "./impact";
import {
  containsForbiddenScript,
  isConditionAst,
  parseFormSchema,
  validateCustomValues,
  type FormField,
} from "./schema";

const field = (overrides: Partial<FormField> & Pick<FormField, "key" | "type" | "label">): FormField => ({
  id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
  required: false,
  ...overrides,
});

describe("form schema", () => {
  it("rejects executable scripts in schema JSON", () => {
    expect(containsForbiddenScript({ fields: [{ label: "() => steal()" }] })).toBe(true);
    expect(containsForbiddenScript({ fields: [{ helpText: "eval('x')" }] })).toBe(true);
    expect(
      parseFormSchema({
        fields: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            key: "note",
            type: "shortText",
            label: "Note",
            required: false,
            visibility: { op: "equals", field: "note", value: "function(){}" },
          },
        ],
      }),
    ).toBeNull();
  });

  it("accepts a strict AST and rejects unknown operators", () => {
    expect(isConditionAst({ op: "equals", field: "severity", value: "high" })).toBe(true);
    expect(isConditionAst({ op: "eval", code: "1+1" })).toBe(false);
    expect(isConditionAst({ op: "equals", field: "severity", value: "high", extra: true })).toBe(false);
  });

  it("evaluates nested boolean AST nodes", () => {
    const ast = {
      op: "and" as const,
      children: [
        { op: "equals" as const, field: "region", value: "eu" },
        { op: "greaterThan" as const, field: "score", value: 3 },
      ],
    };
    expect(evaluateCondition(ast, { region: "eu", score: 4 })).toBe(true);
    expect(evaluateCondition(ast, { region: "eu", score: 2 })).toBe(false);
  });

  it("hides fields whose visibility AST does not match", () => {
    const fields = [
      field({ key: "has_vendor", type: "boolean", label: "Vendor", required: true }),
      field({
        id: "22222222-2222-4222-8222-222222222222",
        key: "vendor_name",
        type: "shortText",
        label: "Vendor name",
        required: true,
        visibility: { op: "equals", field: "has_vendor", value: true },
      }),
    ];
    expect([...visibleFieldKeys(fields, { has_vendor: false })]).toEqual(["has_vendor"]);
    expect([...visibleFieldKeys(fields, { has_vendor: true })]).toEqual(["has_vendor", "vendor_name"]);
  });

  it("does not require hidden fields and rejects unknown keys", () => {
    const schema = {
      fields: [
        field({ key: "has_vendor", type: "boolean", label: "Vendor", required: true }),
        field({
          id: "22222222-2222-4222-8222-222222222222",
          key: "vendor_name",
          type: "shortText",
          label: "Vendor name",
          required: true,
          visibility: { op: "equals", field: "has_vendor", value: true },
        }),
      ],
    };
    const hidden = validateCustomValues(schema, { has_vendor: false }, visibleFieldKeys(schema.fields, { has_vendor: false }));
    expect(hidden).toEqual({ ok: true, values: { has_vendor: false } });

    const missing = validateCustomValues(schema, { has_vendor: true }, visibleFieldKeys(schema.fields, { has_vendor: true }));
    expect(missing.ok).toBe(false);

    const extra = validateCustomValues(schema, { has_vendor: false, unknown: "x" }, new Set(["has_vendor"]));
    expect(extra.ok).toBe(false);
  });

  it("reports removed keys that still have stored values", () => {
    const previous = { fields: [field({ key: "old_note", type: "shortText", label: "Old" })] };
    const next = { fields: [field({ key: "new_note", type: "shortText", label: "New" })] };
    const diff = diffFormSchemas(previous, next);
    expect(diff.removedKeys).toEqual(["old_note"]);
    expect(diff.addedKeys).toEqual(["new_note"]);
    expect(
      countAffectedRecords(diff.removedKeys, [{ customValues: { old_note: "keep me" } }, { customValues: {} }]),
    ).toBe(1);
  });
});
