import type { ReactNode } from "react";

type KpiCardProps = {
  label: string;
  value: string | number;
  description?: string;
  action?: ReactNode;
  testId?: string;
};

function KpiCard({ label, value, description, action, testId }: KpiCardProps) {
  return (
    <article className="rounded-lg border bg-card p-4" data-testid={testId}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3 [&_a]:cursor-pointer">{action}</div> : null}
    </article>
  );
}

export { KpiCard };
