import type { FormSchema } from "./schema";

export type MigrationImpact = {
  addedKeys: string[];
  removedKeys: string[];
  typeChanged: Array<{ key: string; from: string; to: string }>;
  affectedRecordCount: number;
};

export function diffFormSchemas(previous: FormSchema | null, next: FormSchema): Omit<MigrationImpact, "affectedRecordCount"> {
  const previousByKey = new Map((previous?.fields ?? []).map((field) => [field.key, field]));
  const nextByKey = new Map(next.fields.map((field) => [field.key, field]));
  const addedKeys = next.fields.filter((field) => !previousByKey.has(field.key)).map((field) => field.key);
  const removedKeys = [...previousByKey.keys()].filter((key) => !nextByKey.has(key));
  const typeChanged: Array<{ key: string; from: string; to: string }> = [];
  for (const [key, previousField] of previousByKey) {
    const nextField = nextByKey.get(key);
    if (nextField && nextField.type !== previousField.type) {
      typeChanged.push({ key, from: previousField.type, to: nextField.type });
    }
  }
  return { addedKeys, removedKeys, typeChanged };
}

export function fieldHasStoredValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

export function countAffectedRecords(
  removedKeys: string[],
  records: Array<{ customValues: Record<string, unknown> }>,
): number {
  if (removedKeys.length === 0) {
    return 0;
  }
  const removed = new Set(removedKeys);
  return records.filter((record) =>
    Object.entries(record.customValues).some(([key, value]) => removed.has(key) && fieldHasStoredValue(value)),
  ).length;
}
