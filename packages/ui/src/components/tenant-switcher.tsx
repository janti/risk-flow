"use client";

import type { TenantOption } from "../types";
import { useT } from "../locale";

type TenantSwitcherProps = {
  tenantSlug: string;
  tenants?: TenantOption[];
};

function TenantSwitcher({ tenantSlug, tenants = [] }: TenantSwitcherProps) {
  const options = tenants.length > 0 ? tenants : [{ slug: tenantSlug, name: tenantSlug }];
  const t = useT();

  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("nav.organizationLabel")}</p>
      <p className="truncate text-sm font-semibold" data-testid="tenant-slug">
        {tenantSlug}
      </p>
      <nav className="mt-2 space-y-1" aria-label={t("a11y.switchOrganization")}>
        {options.map((tenant) => (
          <a
            key={tenant.slug}
            href={`/t/${tenant.slug}/home`}
            className="block truncate text-sm text-primary underline-offset-2 hover:underline"
            data-testid={`switch-tenant-${tenant.slug}`}
          >
            {tenant.name}
          </a>
        ))}
      </nav>
    </div>
  );
}

export { TenantSwitcher };
