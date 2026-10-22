"use client";

import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Skeleton,
  Spinner,
  useT,
} from "@riskflow/ui";
import type { FormDefinitionRecord } from "@riskflow/form-engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";

type FormListProps = {
  tenantSlug: string;
};

export function FormList({ tenantSlug }: FormListProps) {
  const t = useT();
  const apiError = useApiError();
  const router = useRouter();
  const [forms, setForms] = useState<FormDefinitionRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("risk");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiRequest<{ forms: FormDefinitionRecord[] }>(`/api/v1/tenants/${tenantSlug}/forms`).then((result) => {
      if (!result.ok) {
        setError(apiError(result));
        return;
      }
      setForms(result.data.forms);
    });
  }, [tenantSlug]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await apiRequest<{ form: FormDefinitionRecord }>(`/api/v1/tenants/${tenantSlug}/forms`, {
      method: "POST",
      body: JSON.stringify({ key, name, targetEntity: "risk" }),
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    router.push(`/t/${tenantSlug}/settings/forms/${result.data.form.id}/edit`);
  }

  if (error) {
    return <ErrorState title={t("forms.loadError")} description={error} />;
  }
  if (!forms) {
    return (
      <div className="space-y-3">
        <Spinner label={t("common.loading")} className="justify-start py-2" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("forms.title")}
        description={t("forms.description")}
        actions={
          <Button
            type="button"
            onClick={() => {
              setName((current) => current || t("forms.defaultName"));
              setOpen(true);
            }}
            data-testid="form-create"
          >
            {t("forms.new")}
          </Button>
        }
      />
      {forms.length === 0 ? (
        <EmptyState title={t("forms.emptyTitle")} description={t("forms.emptyDescription")} />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[40rem] text-left text-sm" data-testid="form-table">
          <caption className="sr-only">{t("forms.tableCaption")}</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="px-4 py-2">{t("common.key")}</th>
              <th scope="col" className="px-4 py-2">{t("common.name")}</th>
              <th scope="col" className="px-4 py-2">{t("forms.published")}</th>
              <th scope="col" className="px-4 py-2">{t("forms.draft")}</th>
              <th scope="col" className="px-4 py-2">
                <span className="sr-only">{t("common.edit")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <tr key={form.id} className="border-b" data-testid={`form-row-${form.key}`}>
                <th scope="row" className="px-4 py-2 font-medium">{form.key}</th>
                <td className="px-4 py-2">{form.name}</td>
                <td className="px-4 py-2">{form.latestPublishedVersion ? `v${form.latestPublishedVersion}` : "—"}</td>
                <td className="px-4 py-2">{form.draftVersion ? `v${form.draftVersion}` : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/t/${tenantSlug}/settings/forms/${form.id}/edit`} data-testid={`form-edit-${form.key}`}>
                      {t("common.edit")}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto" data-testid="form-create-dialog">
          <SheetTitle>{t("forms.new")}</SheetTitle>
          <SheetDescription>{t("forms.createDescription")}</SheetDescription>
          <form className="mt-4 space-y-4" onSubmit={onCreate}>
            <label className="block text-sm">
              {t("common.key")}
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                name="key"
                required
                pattern="^[a-z][a-z0-9_]{0,63}$"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                data-testid="form-key"
              />
            </label>
            <label className="block text-sm">
              {t("common.name")}
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                name="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                data-testid="form-name"
              />
            </label>
            {message ? (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={saving} data-testid="form-create-submit">
                {t("common.create")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
