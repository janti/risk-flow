"use client";

import type { NavigationItem } from "../types";
import { cn } from "../lib/utils";
import { useT } from "../locale";

type SideNavigationProps = {
  items: NavigationItem[];
  currentPath?: string;
  onNavigate?: () => void;
};

function SideNavigation({ items, currentPath, onNavigate }: SideNavigationProps) {
  const t = useT();
  const primary = items.filter((item) => !item.section);
  const settings = items.filter((item) => item.section === "settings");

  return (
    <nav aria-label={t("a11y.mainNav")} data-testid="sidebar-nav">
      <NavSection items={primary} currentPath={currentPath} onNavigate={onNavigate} />
      {settings.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("nav.settings")}
          </p>
          <NavSection items={settings} currentPath={currentPath} onNavigate={onNavigate} />
        </div>
      ) : null}
    </nav>
  );
}

function NavSection({
  items,
  currentPath,
  onNavigate,
}: {
  items: NavigationItem[];
  currentPath?: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath === item.href || currentPath?.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export { SideNavigation };
