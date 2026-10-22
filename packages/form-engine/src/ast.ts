import { isConditionAst, type ConditionAst, type FormField } from "./schema";

const MAX_DEPTH = 8;

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (typeof left === "number" || typeof right === "number") {
    const a = readNumber(left);
    const b = readNumber(right);
    return a !== null && b !== null && a === b;
  }
  return String(left ?? "") === String(right ?? "");
}

export function evaluateCondition(
  ast: ConditionAst,
  values: Record<string, unknown>,
  depth = 0,
): boolean {
  if (depth > MAX_DEPTH) {
    return false;
  }
  switch (ast.op) {
    case "and":
      return ast.children.every((child) => evaluateCondition(child, values, depth + 1));
    case "or":
      return ast.children.some((child) => evaluateCondition(child, values, depth + 1));
    case "not":
      return !evaluateCondition(ast.child, values, depth + 1);
    case "equals":
      return valuesEqual(values[ast.field], ast.value);
    case "in": {
      const haystack = Array.isArray(ast.value) ? ast.value : [ast.value];
      const current = values[ast.field];
      if (Array.isArray(current)) {
        return current.some((item) => haystack.some((candidate) => valuesEqual(item, candidate)));
      }
      return haystack.some((candidate) => valuesEqual(current, candidate));
    }
    case "greaterThan": {
      const left = readNumber(values[ast.field]);
      const right = readNumber(ast.value);
      return left !== null && right !== null && left > right;
    }
    default:
      return false;
  }
}

export function visibleFieldKeys(fields: FormField[], values: Record<string, unknown>): Set<string> {
  const visible = new Set<string>();
  for (const field of fields) {
    if (!field.visibility) {
      visible.add(field.key);
      continue;
    }
    if (!isConditionAst(field.visibility)) {
      continue;
    }
    if (evaluateCondition(field.visibility, values)) {
      visible.add(field.key);
    }
  }
  return visible;
}
