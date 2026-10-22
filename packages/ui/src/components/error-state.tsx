"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "../locale";
import { Button } from "./ui/button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
};

function ErrorState({ title, description, onRetry, action }: ErrorStateProps) {
  const t = useT();
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-card px-6 py-16 text-center"
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle className="mb-4 h-10 w-10 text-destructive" aria-hidden="true" />
      <h2 className="text-lg font-semibold">{title ?? t("error.genericTitle")}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description ?? t("error.genericDescription")}
      </p>
      {onRetry ? (
        <Button className="mt-6" type="button" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export { ErrorState };
