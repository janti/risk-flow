"use client";

import { orderedFields, visibleFieldKeys, type FormField, type FormSchema, type FormUi } from "@riskflow/form-engine";
import { useT } from "@riskflow/ui";

export type FormLookupOption = { id: string; label: string };

export type RiskFormRendererProps = {
  schema: FormSchema;
  ui?: FormUi;
  values: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
  users?: FormLookupOption[];
  orgUnits?: FormLookupOption[];
  testId?: string;
};

const inputClass = "mt-1 w-full rounded-md border bg-background px-3 py-2";

function asString(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function BooleanReadValue({ fieldKey, state }: { fieldKey: string; state: "yes" | "no" | "empty" }) {
  const t = useT();
  const label = state === "yes" ? t("common.yes") : state === "no" ? t("common.no") : "—";
  return <p data-testid={`custom-value-${fieldKey}`}>{label}</p>;
}

function FieldControl({
  field,
  value,
  readOnly,
  onChange,
  users,
  orgUnits,
}: {
  field: FormField;
  value: unknown;
  readOnly: boolean;
  onChange: (value: unknown) => void;
  users: FormLookupOption[];
  orgUnits: FormLookupOption[];
}) {
  const t = useT();
  const name = `custom-${field.key}`;
  const required = field.required && field.type !== "boolean";
  if (readOnly) {
    if (field.type === "boolean") {
      const yesNo = value === true ? "yes" : value === false ? "no" : "empty";
      return <BooleanReadValue fieldKey={field.key} state={yesNo} />;
    }
    if (field.type === "multiSelect" && Array.isArray(value)) {
      return <p data-testid={`custom-value-${field.key}`}>{value.join(", ") || "—"}</p>;
    }
    if (field.type === "user") {
      const user = users.find((item) => item.id === value);
      return <p data-testid={`custom-value-${field.key}`}>{user?.label ?? (asString(value) || "—")}</p>;
    }
    if (field.type === "orgUnit") {
      const unit = orgUnits.find((item) => item.id === value);
      return <p data-testid={`custom-value-${field.key}`}>{unit?.label ?? (asString(value) || "—")}</p>;
    }
    return <p data-testid={`custom-value-${field.key}`}>{asString(value) || "—"}</p>;
  }

  switch (field.type) {
    case "longText":
      return (
        <textarea
          className={`${inputClass} min-h-24`}
          name={name}
          required={required}
          aria-required={required || undefined}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
          data-testid={`custom-field-${field.key}`}
        />
      );
    case "number":
      return (
        <input
          className={inputClass}
          name={name}
          type="number"
          required={required}
          aria-required={required || undefined}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
          data-testid={`custom-field-${field.key}`}
        />
      );
    case "date":
      return (
        <input
          className={inputClass}
          name={name}
          type="date"
          required={required}
          aria-required={required || undefined}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value || undefined)}
          data-testid={`custom-field-${field.key}`}
        />
      );
    case "boolean":
      return (
        <input
          className="mt-2 h-4 w-4"
          name={name}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          data-testid={`custom-field-${field.key}`}
        />
      );
    case "select":
    case "user":
    case "orgUnit": {
      const options =
        field.type === "user" ? users : field.type === "orgUnit" ? orgUnits : (field.options ?? []).map((option) => ({
          id: option.value,
          label: option.label,
        }));
      return (
        <select
          className={inputClass}
          name={name}
          required={required}
          aria-required={required || undefined}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value || undefined)}
          data-testid={`custom-field-${field.key}`}
        >
          <option value="">{t("common.select")}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    case "multiSelect": {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <select
          className={inputClass}
          name={name}
          multiple
          required={required}
          aria-required={required || undefined}
          value={selected}
          onChange={(event) =>
            onChange(Array.from(event.target.selectedOptions).map((option) => option.value))
          }
          data-testid={`custom-field-${field.key}`}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    default:
      return (
        <input
          className={inputClass}
          name={name}
          required={required}
          aria-required={required || undefined}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
          data-testid={`custom-field-${field.key}`}
        />
      );
  }
}

export function RiskFormRenderer({
  schema,
  ui,
  values,
  onChange,
  readOnly = false,
  users = [],
  orgUnits = [],
  testId = "risk-form-renderer",
}: RiskFormRendererProps) {
  const fields = orderedFields(schema, ui ?? { fieldOrder: schema.fields.map((field) => field.id) });
  const visible = visibleFieldKeys(fields, values);

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid={testId}>
      {fields
        .filter((field) => visible.has(field.key))
        .map((field) => (
          <label key={field.id} className="block text-sm">
            <span>
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.helpText ? <span className="mt-0.5 block text-xs text-muted-foreground">{field.helpText}</span> : null}
            <FieldControl
              field={field}
              value={values[field.key]}
              readOnly={readOnly}
              users={users}
              orgUnits={orgUnits}
              onChange={(next) => {
                if (!onChange) {
                  return;
                }
                const updated = { ...values };
                if (next === undefined) {
                  delete updated[field.key];
                } else {
                  updated[field.key] = next;
                }
                onChange(updated);
              }}
            />
          </label>
        ))}
    </div>
  );
}
