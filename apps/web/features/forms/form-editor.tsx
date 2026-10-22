"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FORM_FIELD_TYPES,
  orderedFields,
  type ConditionAst,
  type FormDefinitionRecord,
  type FormField,
  type FormFieldType,
  type FormVersionRecord,
  type MigrationImpact,
} from "@riskflow/form-engine";
import { fieldTypeMessageKey, type MessageKey } from "@riskflow/shared";
import { Button, ErrorState, PageHeader, Skeleton, useT } from "@riskflow/ui";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";
import { RiskFormRenderer } from "./risk-form-renderer";

type FormEditorProps = {
  tenantSlug: string;
  formId: string;
};

function newField(
  type: FormFieldType,
  existing: FormField[],
  labels: { type: string; option: (n: number) => string },
): FormField {
  const count = existing.filter((field) => field.type === type).length + 1;
  const keyBase = type.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  let key = `${keyBase}_${count}`;
  const keys = new Set(existing.map((field) => field.key));
  let suffix = count;
  while (keys.has(key)) {
    suffix += 1;
    key = `${keyBase}_${suffix}`;
  }
  const field: FormField = {
    id: crypto.randomUUID(),
    key,
    type,
    label: labels.type,
    required: false,
  };
  if (type === "select" || type === "multiSelect") {
    field.options = [
      { value: "option_1", label: labels.option(1) },
      { value: "option_2", label: labels.option(2) },
    ];
  }
  return field;
}

function SortableField({
  field,
  selected,
  onSelect,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border bg-background px-2 py-2 ${selected ? "ring-2 ring-ring" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab rounded p-1 text-muted-foreground"
        aria-label={`Raahaa ${field.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex-1 text-left text-sm"
        onClick={onSelect}
        data-testid={`form-field-${field.key}`}
      >
        <span className="font-medium">{field.label}</span>
        <span className="ml-2 text-muted-foreground">{field.key}</span>
      </button>
    </div>
  );
}

function fieldTypeLabel(translate: (key: MessageKey, vars?: Record<string, string | number>) => string, type: FormFieldType): string {
  const key = fieldTypeMessageKey(type);
  return key ? translate(key) : type;
}

export function FormEditor({ tenantSlug, formId }: FormEditorProps) {
  const t = useT();
  const apiError = useApiError();
  const router = useRouter();
  const [form, setForm] = useState<FormDefinitionRecord | null>(null);
  const [draft, setDraft] = useState<FormVersionRecord | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [impact, setImpact] = useState<MigrationImpact | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = fields.find((field) => field.id === selectedId) ?? null;

  useEffect(() => {
    void (async () => {
      const result = await apiRequest<{ form: FormDefinitionRecord }>(`/api/v1/tenants/${tenantSlug}/forms/${formId}`);
      if (!result.ok) {
        setError(apiError(result));
        return;
      }
      const loaded = result.data.form;
      let working = loaded.versions.find((version) => version.status === "draft") ?? null;
      if (!working) {
        const created = await apiRequest<{ version: FormVersionRecord }>(
          `/api/v1/tenants/${tenantSlug}/forms/${formId}/versions`,
          { method: "POST", body: JSON.stringify({}) },
        );
        if (!created.ok) {
          setError(apiError(created));
          return;
        }
        working = created.data.version;
      }
      setForm(loaded);
      setDraft(working);
      setFields(orderedFields(working.schema, working.ui));
      setSelectedId(working.schema.fields[0]?.id ?? null);
    })();
  }, [formId, tenantSlug]);

  const schema = useMemo(() => ({ fields }), [fields]);
  const ui = useMemo(() => ({ fieldOrder: fields.map((field) => field.id) }), [fields]);

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    setFields((current) => {
      const oldIndex = current.findIndex((field) => field.id === active.id);
      const newIndex = current.findIndex((field) => field.id === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  async function saveDraft() {
    if (!draft) {
      return false;
    }
    setSaving(true);
    setMessage(null);
    const result = await apiRequest<{ version: FormVersionRecord }>(
      `/api/v1/tenants/${tenantSlug}/forms/${formId}/versions/${draft.version}`,
      {
        method: "PATCH",
        body: JSON.stringify({ schema, ui }),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return false;
    }
    setDraft(result.data.version);
    return true;
  }

  async function openPublish() {
    const saved = await saveDraft();
    if (!saved || !draft) {
      return;
    }
    const preview = await apiRequest<{ impact: MigrationImpact }>(
      `/api/v1/tenants/${tenantSlug}/forms/${formId}/versions/${draft.version}`,
    );
    if (preview.ok) {
      setImpact(preview.data.impact);
    }
    setPublishOpen(true);
  }

  async function publish() {
    if (!draft) {
      return;
    }
    setPublishing(true);
    const result = await apiRequest<{ version: FormVersionRecord; impact: MigrationImpact }>(
      `/api/v1/tenants/${tenantSlug}/forms/${formId}/versions/${draft.version}/publish`,
      { method: "POST", body: JSON.stringify({}) },
    );
    setPublishing(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setPublishOpen(false);
    router.push(`/t/${tenantSlug}/settings/forms`);
    router.refresh();
  }

  if (error) {
    return <ErrorState title={t("forms.editorError")} description={error} />;
  }
  if (!form || !draft) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.name}
        description={t("forms.draftVersion", { version: draft.version })}
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" loading={saving} onClick={() => void saveDraft()} data-testid="form-save">
              {t("forms.saveDraft")}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void openPublish()} data-testid="form-publish-open">
              {t("forms.publish")}
            </Button>
          </div>
        }
      />
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_18rem]">
        <aside className="space-y-2 rounded-lg border bg-card p-4" data-testid="field-palette">
          <h2 className="text-sm font-semibold">{t("forms.palette")}</h2>
          {FORM_FIELD_TYPES.map((type) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                const created = newField(type, fields, {
                  type: fieldTypeLabel(t, type),
                  option: (n) => t("fieldType.option", { n }),
                });
                setFields((current) => [...current, created]);
                setSelectedId(created.id);
              }}
              data-testid={`palette-${type}`}
            >
              {fieldTypeLabel(t, type)}
            </Button>
          ))}
        </aside>
        <section className="space-y-3 rounded-lg border bg-card p-4" data-testid="form-canvas">
          <h2 className="text-sm font-semibold">{t("forms.fields")}</h2>
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("forms.addFromPalette")}</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      selected={field.id === selectedId}
                      onSelect={() => setSelectedId(field.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">{t("forms.preview")}</h3>
            <RiskFormRenderer
              schema={schema}
              ui={ui}
              values={previewValues}
              onChange={setPreviewValues}
              testId="form-preview"
            />
          </div>
        </section>
        <aside className="space-y-3 rounded-lg border bg-card p-4" data-testid="field-properties">
          <h2 className="text-sm font-semibold">{t("forms.properties")}</h2>
          {selected ? (
            <FieldProperties
              field={selected}
              otherFields={fields.filter((field) => field.id !== selected.id)}
              onChange={(patch) => updateField(selected.id, patch)}
              onRemove={() => {
                setFields((current) => current.filter((field) => field.id !== selected.id));
                setSelectedId(null);
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("forms.selectField")}</p>
          )}
        </aside>
      </div>
      {publishOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-form-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6">
            <h2 id="publish-form-title" className="text-lg font-semibold">
              {t("forms.publishTitle", { version: draft.version })}
            </h2>
            <p className="text-sm text-muted-foreground">{t("forms.publishDescription")}</p>
            {impact ? (
              <ul className="text-sm" data-testid="form-impact">
                <li>{t("forms.addedKeys", { keys: impact.addedKeys.join(", ") || t("common.none") })}</li>
                <li>{t("forms.removedKeys", { keys: impact.removedKeys.join(", ") || t("common.none") })}</li>
                <li>{t("forms.affected", { count: impact.affectedRecordCount })}</li>
              </ul>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPublishOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" loading={publishing} onClick={() => void publish()} data-testid="form-publish">
                {t("forms.publish")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldProperties({
  field,
  otherFields,
  onChange,
  onRemove,
}: {
  field: FormField;
  otherFields: FormField[];
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const visibility = field.visibility;
  const equalsRule = visibility && visibility.op === "equals" ? visibility : null;

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        {t("common.key")}
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          value={field.key}
          onChange={(event) => onChange({ key: event.target.value })}
          data-testid="field-key"
        />
      </label>
      <label className="block text-sm">
        {t("common.title")}
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          value={field.label}
          onChange={(event) => onChange({ label: event.target.value })}
          data-testid="field-label"
        />
      </label>
      <label className="block text-sm">
        {t("forms.helpText")}
        <input
          className="mt-1 w-full rounded-md border bg-background px-3 py-2"
          value={field.helpText ?? ""}
          onChange={(event) => onChange({ helpText: event.target.value || undefined })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event) => onChange({ required: event.target.checked })}
          data-testid="field-required"
        />
        {t("common.required")}
      </label>
      {field.type === "select" || field.type === "multiSelect" ? (
        <label className="block text-sm">
          {t("forms.optionsHelp")}
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2"
            value={(field.options ?? []).map((option) => `${option.value}|${option.label}`).join("\n")}
            onChange={(event) =>
              onChange({
                options: event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .flatMap((line) => {
                    const [rawValue, ...label] = line.split("|");
                    if (!rawValue) {
                      return [];
                    }
                    return [{ value: rawValue.trim(), label: (label.join("|") || rawValue).trim() }];
                  }),
              })
            }
            data-testid="field-options"
          />
        </label>
      ) : null}
      <fieldset className="space-y-2 rounded-md border p-3" data-testid="conditional-rule-editor">
        <legend className="text-sm font-medium">{t("forms.visibility")}</legend>
        <label className="block text-sm">
          {t("forms.showWhen")}
          <select
            className="mt-1 w-full rounded-md border bg-background px-3 py-2"
            value={equalsRule?.field ?? ""}
            onChange={(event) => {
              const nextField = event.target.value;
              if (!nextField) {
                onChange({ visibility: undefined });
                return;
              }
              onChange({
                visibility: { op: "equals", field: nextField, value: equalsRule?.value ?? "" } satisfies ConditionAst,
              });
            }}
            data-testid="rule-field"
          >
            <option value="">{t("forms.alwaysVisible")}</option>
            {otherFields.map((item) => (
              <option key={item.id} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {equalsRule ? (
          <label className="block text-sm">
            {t("forms.equals")}
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={String(equalsRule.value ?? "")}
              onChange={(event) =>
                onChange({
                  visibility: { op: "equals", field: equalsRule.field, value: event.target.value },
                })
              }
              data-testid="rule-value"
            />
          </label>
        ) : null}
      </fieldset>
      <Button type="button" variant="destructive" onClick={onRemove}>
        {t("forms.removeField")}
      </Button>
    </div>
  );
}
