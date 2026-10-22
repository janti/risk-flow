"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import type { AppShellProps } from "../types";
import { useT } from "../locale";
import { Breadcrumbs } from "./breadcrumbs";
import { SideNavigation } from "./side-navigation";
import { TenantSwitcher } from "./tenant-switcher";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";

function AppShell({
  tenantSlug,
  brandName = "RiskFlow",
  navigation,
  breadcrumbs,
  currentPath,
  tenants,
  accountMenu,
  toolbar,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useT();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("a11y.skipToContent")}
      </a>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
          <div className="flex h-14 items-center px-4 text-lg font-semibold">{brandName}</div>
          <Separator />
          <div className="space-y-4 p-4">
            <TenantSwitcher tenantSlug={tenantSlug} tenants={tenants} />
            <SideNavigation items={navigation} currentPath={currentPath} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-expanded={mobileOpen}
                  aria-controls="mobile-sidebar"
                  data-testid="open-sidebar"
                >
                  <Menu />
                  <span className="sr-only">{t("a11y.openNavigation")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent id="mobile-sidebar" data-testid="mobile-sidebar" side="left">
                <SheetTitle className="text-left text-lg font-semibold">{brandName}</SheetTitle>
                <TenantSwitcher tenantSlug={tenantSlug} tenants={tenants} />
                <SideNavigation
                  items={navigation}
                  currentPath={currentPath}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1">
              {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : toolbar}
            </div>
            {accountMenu}
            <ThemeToggle />
          </header>
          <main id="main-content" tabIndex={-1} className="flex-1 scroll-mt-16 p-4 sm:p-6 outline-none">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export { AppShell };
