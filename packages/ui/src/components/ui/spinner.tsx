import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { useT } from "../../locale";

type SpinnerProps = {
  className?: string;
  label?: string;
  srOnly?: boolean;
};

function Spinner({ className, label, srOnly = false }: SpinnerProps) {
  const t = useT();
  const text = label ?? t("common.loading");
  return (
    <div
      className={cn("flex items-center justify-center gap-2 text-sm text-muted-foreground", className)}
      role="status"
      aria-live="polite"
      data-testid="spinner"
    >
      <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
      <span className={srOnly ? "sr-only" : undefined}>{text}</span>
    </div>
  );
}

export { Spinner };
export type { SpinnerProps };
