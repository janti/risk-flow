import { RoleHome } from "../../../../../features/dashboards/role-home";
import { getCurrentTenantAccess } from "../../../../../lib/current-access";

export default async function HomePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const access = await getCurrentTenantAccess(tenantSlug);
  if (!access) {
    return null;
  }

  return (
    <RoleHome tenantSlug={tenantSlug} displayName={access.user.displayName} roleKeys={access.roleKeys} />
  );
}
