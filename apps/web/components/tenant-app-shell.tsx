"use client";

import type { PermissionKey } from "@riskflow/permissions";
import { AppShell, useLocale } from "@riskflow/ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { tenantNavigation } from "../lib/navigation";

type TenantAppShellProps = {
  tenantSlug: string;
  tenants: { slug: string; name: string }[];
  permissions: readonly PermissionKey[];
  enabledModules: readonly string[];
  brandName?: string;
  accountMenu: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
};

export function TenantAppShell({
  tenantSlug,
  tenants,
  permissions,
  enabledModules,
  brandName,
  accountMenu,
  toolbar,
  children,
}: TenantAppShellProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const navigation = tenantNavigation(tenantSlug, locale).filter(
    (item) =>
      (!item.permission || permissions.includes(item.permission)) &&
      (!item.moduleKey || enabledModules.includes(item.moduleKey)),
  );

  return (
    <AppShell
      tenantSlug={tenantSlug}
      brandName={brandName}
      tenants={tenants}
      navigation={navigation}
      currentPath={pathname}
      accountMenu={accountMenu}
      toolbar={toolbar}
    >
      {children}
    </AppShell>
  );
}
