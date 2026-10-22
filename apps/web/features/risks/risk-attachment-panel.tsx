"use client";

import type { AttachmentRecord } from "@riskflow/risk-engine";
import { Button, EmptyState, ErrorState, PermissionGate, Skeleton, Spinner, buttonVariants, useT } from "@riskflow/ui";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";

type RiskAttachmentPanelProps = {
  tenantSlug: string;
  riskId: string;
  canUpdate: boolean;
};

function scanKey(status: AttachmentRecord["scanStatus"]): "attachments.scan.pending" | "attachments.scan.clean" | "attachments.scan.infected" | "attachments.scan.skipped" {
  if (status === "clean") {
    return "attachments.scan.clean";
  }
  if (status === "infected") {
    return "attachments.scan.infected";
  }
  if (status === "skipped") {
    return "attachments.scan.skipped";
  }
  return "attachments.scan.pending";
}

export function RiskAttachmentPanel({ tenantSlug, riskId, canUpdate }: RiskAttachmentPanelProps) {
  const t = useT();
  const apiError = useApiError();
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiRequest<{ attachments: AttachmentRecord[] }>(
      `/api/v1/tenants/${tenantSlug}/risks/${riskId}/attachments`,
    );
    setLoading(false);
    if (!result.ok) {
      setError(apiError(result));
      return;
    }
    setAttachments(result.data.attachments);
  }, [apiError, riskId, tenantSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploading(true);
    setMessage(null);
    const intent = await apiRequest<{ attachment: AttachmentRecord; uploadUrl: string }>(
      `/api/v1/tenants/${tenantSlug}/attachments/upload-intent`,
      {
        method: "POST",
        body: JSON.stringify({
          entityType: "risk",
          entityId: riskId,
          filename: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
        }),
      },
    );
    if (!intent.ok) {
      setUploading(false);
      setMessage(apiError(intent));
      return;
    }
    const uploaded = await fetch(intent.data.uploadUrl, {
      method: "PUT",
      credentials: "same-origin",
      body: file,
    });
    setUploading(false);
    if (!uploaded.ok) {
      setMessage(t("attachments.uploadFailed"));
      return;
    }
    await load();
  }

  async function download(attachment: AttachmentRecord) {
    setMessage(null);
    const result = await apiRequest<{ downloadUrl: string }>(
      `/api/v1/tenants/${tenantSlug}/attachments/${attachment.id}`,
    );
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    window.location.assign(result.data.downloadUrl);
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-6" data-testid="risk-attachments">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("attachments.title")}</h2>
        <PermissionGate allowed={canUpdate}>
          <label className={buttonVariants({ variant: "outline" })}>
            <input
              type="file"
              className="sr-only"
              data-testid="attachment-file"
              disabled={uploading}
              onChange={(event) => void onFile(event)}
            />
            {uploading ? <Spinner className="text-foreground" label={t("attachments.uploading")} /> : t("attachments.upload")}
          </label>
        </PermissionGate>
      </div>
      {error ? <ErrorState title={t("attachments.loadError")} description={error} onRetry={() => void load()} /> : null}
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      {loading ? (
        <div className="space-y-2">
          <Spinner label={t("common.loading")} className="justify-start" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}
      {!loading && attachments.length === 0 ? (
        <EmptyState title={t("attachments.emptyTitle")} description={t("attachments.emptyDescription")} />
      ) : null}
      {attachments.length > 0 ? (
        <ul className="divide-y">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{attachment.filename}</p>
                <p className="text-sm text-muted-foreground">{t(scanKey(attachment.scanStatus))}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={!attachment.uploadedAt || attachment.scanStatus !== "clean"}
                onClick={() => void download(attachment)}
                data-testid={`attachment-download-${attachment.id}`}
              >
                {t("attachments.download")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
