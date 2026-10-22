"use client";

import { statusMessageKey } from "@riskflow/shared";
import { useT } from "../locale";
import { Badge } from "./ui/badge";

type StatusBadgeProps = {
  status: string;
};

function StatusBadge({ status }: StatusBadgeProps) {
  const t = useT();
  const key = statusMessageKey(status);
  const variant =
    status === "low" || status === "medium" || status === "high" || status === "critical"
      ? status
      : "secondary";

  return <Badge variant={variant}>{key ? t(key) : status}</Badge>;
}

export { StatusBadge };
