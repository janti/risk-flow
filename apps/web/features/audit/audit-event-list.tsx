"use client";

import type { AuditEventRecord } from "@riskflow/risk-engine";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, Spinner, useT } from "@riskflow/ui";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";

type AuditEventListProps = {
  tenantSlug: string;
};

export function AuditEventList({ tenantSlug }: AuditEventListProps) {
  const t = useT();
  const apiError = useApiError();
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (cursor?: string | null) => {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const params = new URLSearchParams({ limit: "25" });
      if (cursor) {
        params.set("cursor", cursor);
      }
      const result = await apiRequest<{ events: AuditEventRecord[] }>(
        `/api/v1/tenants/${tenantSlug}/audit-events?${params.toString()}`,
      );
      setLoading(false);
      setLoadingMore(false);
      if (!result.ok) {
        setError(apiError(result));
        return;
      }
      setEvents((current) => (cursor ? [...current, ...result.data.events] : result.data.events));
      setNextCursor(typeof result.meta.nextCursor === "string" ? result.meta.nextCursor : null);
    },
    [apiError, tenantSlug],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4" data-testid="audit-events">
      <PageHeader title={t("audit.title")} description={t("audit.description")} />
      {error ? <ErrorState title={t("audit.loadError")} description={error} onRetry={() => void load()} /> : null}
      {loading ? (
        <div className="space-y-2">
          <Spinner label={t("common.loading")} className="justify-start py-2" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : null}
      {!loading && events.length === 0 ? (
        <EmptyState title={t("audit.emptyTitle")} description={t("audit.emptyDescription")} />
      ) : null}
      {events.length > 0 ? (
        <ol className="divide-y rounded-lg border bg-card">
          {events.map((event) => (
            <li key={event.id} className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr]" data-testid="audit-event">
              <time className="text-sm text-muted-foreground" dateTime={event.occurredAt}>
                {event.occurredAt.replace("T", " ").slice(0, 19)}
              </time>
              <div>
                <p className="font-medium">
                  {event.action} · {event.entityType}
                </p>
                <p className="text-sm text-muted-foreground">
                  {event.actorName ?? t("audit.system")} · {event.entityId}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {nextCursor ? (
        <Button type="button" variant="outline" loading={loadingMore} onClick={() => void load(nextCursor)}>
          {t("common.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
