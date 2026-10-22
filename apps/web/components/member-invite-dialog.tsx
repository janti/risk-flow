"use client";

import { Button, useT } from "@riskflow/ui";
import { useState, type FormEvent } from "react";
import { apiRequest } from "../lib/api-client";
import { useApiError } from "../lib/use-api-error";

type MemberInviteDialogProps = {
  tenantSlug: string;
};

export function MemberInviteDialog({ tenantSlug }: MemberInviteDialogProps) {
  const t = useT();
  const apiError = useApiError();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("employee");
  const [message, setMessage] = useState<string | null>(null);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setAcceptUrl(null);
    setSaving(true);
    const result = await apiRequest<{ invitation?: { acceptUrl?: string } }>(
      `/api/v1/tenants/${tenantSlug}/memberships`,
      {
        method: "POST",
        body: JSON.stringify({ email, roleKey }),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setAcceptUrl(result.data.invitation?.acceptUrl ?? null);
    setMessage(t("users.inviteCreated"));
    setEmail("");
  }

  return (
    <div>
      <Button type="button" onClick={() => setOpen(true)}>
        {t("users.invite")}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-title"
        >
          <form className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6" onSubmit={onSubmit}>
            <h2 id="invite-title" className="text-lg font-semibold">
              {t("users.inviteTitle")}
            </h2>
            <label className="block text-sm">
              {t("common.email")}
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                type="email"
                name="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              {t("users.role")}
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                name="roleKey"
                value={roleKey}
                onChange={(event) => setRoleKey(event.target.value)}
              >
                <option value="employee">employee</option>
                <option value="manager">manager</option>
                <option value="risk-manager">risk-manager</option>
                <option value="tenant-admin">tenant-admin</option>
              </select>
            </label>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            {acceptUrl ? (
              <p className="break-all text-sm" data-testid="invite-url">
                {acceptUrl}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.close")}
              </Button>
              <Button type="submit" loading={saving}>{t("users.sendInvite")}</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
