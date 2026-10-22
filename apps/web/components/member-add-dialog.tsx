"use client";

import { Button, useT } from "@riskflow/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiRequest } from "../lib/api-client";
import { useApiError } from "../lib/use-api-error";

type MemberAddDialogProps = {
  tenantSlug: string;
};

export function MemberAddDialog({ tenantSlug }: MemberAddDialogProps) {
  const t = useT();
  const apiError = useApiError();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleKey, setRoleKey] = useState("employee");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    const result = await apiRequest<{ membership?: { email?: string; pending?: boolean } }>(
      `/api/v1/tenants/${tenantSlug}/memberships`,
      {
        method: "POST",
        body: JSON.stringify({
          mode: "direct",
          email,
          displayName: displayName.trim() || undefined,
          roleKey,
        }),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setMessage(result.data.membership?.pending ? t("users.addedPending") : t("users.addedExisting"));
    setEmail("");
    setDisplayName("");
    router.refresh();
  }

  return (
    <div>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} data-testid="member-add">
        {t("users.add")}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-member-title"
        >
          <form className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6" onSubmit={onSubmit}>
            <h2 id="add-member-title" className="text-lg font-semibold">
              {t("users.addTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("users.addHelp")}</p>
            <label className="block text-sm">
              {t("common.email")}
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                type="email"
                name="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                data-testid="member-add-email"
              />
            </label>
            <label className="block text-sm">
              {t("common.name")}
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                type="text"
                name="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                data-testid="member-add-name"
              />
            </label>
            <label className="block text-sm">
              {t("users.role")}
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                name="roleKey"
                value={roleKey}
                onChange={(event) => setRoleKey(event.target.value)}
                data-testid="member-add-role"
              >
                <option value="employee">employee</option>
                <option value="manager">manager</option>
                <option value="risk-manager">risk-manager</option>
                <option value="tenant-admin">tenant-admin</option>
              </select>
            </label>
            {message ? (
              <p className="text-sm text-muted-foreground" data-testid="member-add-message">
                {message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.close")}
              </Button>
              <Button type="submit" loading={saving} data-testid="member-add-submit">
                {t("users.addMember")}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
