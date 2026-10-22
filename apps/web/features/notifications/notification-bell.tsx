"use client";

import type { NotificationRecord } from "@riskflow/risk-engine";
import { isMessageKey, type MessageKey } from "@riskflow/shared";
import {
  Button,
  EmptyState,
  ErrorState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Skeleton,
  useT,
} from "@riskflow/ui";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";

type NotificationBellProps = {
  tenantSlug: string;
};

function typeKey(type: string): MessageKey {
  const key = `notifications.type.${type}`;
  return isMessageKey(key) ? key : "notifications.type.unknown";
}

function riskHref(tenantSlug: string, payload: Record<string, unknown>): string | null {
  const riskId = typeof payload.riskId === "string" ? payload.riskId : null;
  return riskId ? `/t/${tenantSlug}/risks/${riskId}` : null;
}

export function NotificationBell({ tenantSlug }: NotificationBellProps) {
  const t = useT();
  const apiError = useApiError();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiRequest<{ notifications: NotificationRecord[]; unreadCount: number }>(
      `/api/v1/tenants/${tenantSlug}/notifications?limit=25`,
    );
    setLoading(false);
    if (!result.ok) {
      setError(apiError(result));
      return;
    }
    setItems(result.data.notifications);
    setUnreadCount(result.data.unreadCount);
  }, [apiError, tenantSlug]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function markRead(notification: NotificationRecord) {
    if (notification.readAt) {
      return;
    }
    const result = await apiRequest<{ notification: NotificationRecord }>(
      `/api/v1/tenants/${tenantSlug}/notifications/${notification.id}`,
      { method: "PATCH", body: JSON.stringify({}) },
    );
    if (result.ok) {
      setItems((current) => current.map((item) => (item.id === notification.id ? result.data.notification : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={t("notifications.title")}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="notification-bell"
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <Bell />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground"
            data-testid="notification-unread"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>
      <SheetContent side="right" className="w-80 overflow-y-auto sm:w-96" data-testid="notification-drawer">
        <SheetTitle>{t("notifications.title")}</SheetTitle>
        <SheetDescription>{t("notifications.description")}</SheetDescription>
        {error ? <ErrorState title={t("notifications.loadError")} description={error} onRetry={() => void load()} /> : null}
        {loading ? <Skeleton className="mt-4 h-24 w-full" /> : null}
        {!loading && items.length === 0 ? (
          <EmptyState title={t("notifications.emptyTitle")} description={t("notifications.emptyDescription")} />
        ) : null}
        <ul className="mt-4 space-y-2">
          {items.map((item) => {
            const href = riskHref(tenantSlug, item.payload);
            const key = typeKey(item.type);
            return (
              <li key={item.id} className="rounded-md border p-3">
                <p className={item.readAt ? "text-sm" : "text-sm font-medium"}>{t(key)}</p>
                <div className="mt-2 flex gap-2">
                  {href ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={href} onClick={() => void markRead(item)}>
                        {t("notifications.open")}
                      </Link>
                    </Button>
                  ) : null}
                  {item.readAt ? null : (
                    <Button type="button" size="sm" variant="ghost" onClick={() => void markRead(item)}>
                      {t("notifications.markRead")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
