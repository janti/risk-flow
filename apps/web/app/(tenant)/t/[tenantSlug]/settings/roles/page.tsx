import { RolePermissionMatrix } from "../../../../../../features/settings/role-permission-matrix";
import { RequirePermission } from "../../../../../../components/require-permission";

export default async function RolesSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <RequirePermission tenantSlug={tenantSlug} permission="users:manage">
      <RolePermissionMatrix tenantSlug={tenantSlug} />
    </RequirePermission>
  );
}
