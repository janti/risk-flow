import { isTenantSlug } from "@riskflow/shared";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CommandSearch } from "../../../../components/command-search";
import { LanguageSwitcher } from "../../../../components/language-switcher";
import { NotificationBell } from "../../../../features/notifications/notification-bell";
import { LogoutButton } from "../../../../components/logout-button";
import { TenantAppShell } from "../../../../components/tenant-app-shell";
import { getCurrentMemberships, getCurrentTenantAccess } from "../../../../lib/current-access";

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  if (!isTenantSlug(tenantSlug)) {
    notFound();
  }

  const access = await getCurrentTenantAccess(tenantSlug);
  if (!access) {
    notFound();
  }

  const memberships = await getCurrentMemberships();

  return (
    <TenantAppShell
      tenantSlug={tenantSlug}
      tenants={memberships.map((membership) => ({
        slug: membership.tenantSlug,
        name: membership.tenantName,
      }))}
      permissions={access.permissionKeys}
      enabledModules={access.enabledModules}
      brandName={access.tenant.branding.productName ?? "RiskFlow"}
      toolbar={
        access.enabledModules.includes("risk-register") && access.permissionKeys.includes("risk:read") ? (
          <CommandSearch tenantSlug={tenantSlug} />
        ) : null
      }
      accountMenu={
        <div className="flex items-center gap-2">
          {access.enabledModules.includes("risk-register") ? <NotificationBell tenantSlug={tenantSlug} /> : null}
          <LanguageSwitcher />
          <span className="hidden text-sm text-muted-foreground sm:inline" data-testid="user-name">
            {access.user.displayName}
          </span>
          <LogoutButton />
        </div>
      }
    >
      {children}
    </TenantAppShell>
  );
}
