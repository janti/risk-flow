import type { ReactNode } from "react";
import { ThemeToggle } from "@riskflow/ui";
import { LanguageSwitcher } from "./language-switcher";

export function PublicChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
