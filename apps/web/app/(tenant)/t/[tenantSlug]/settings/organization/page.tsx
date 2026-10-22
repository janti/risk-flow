import { OrganizationSettings } from "../../../../../../features/settings/organization-tree";
import { RequirePermission } from "../../../../../../components/require-permission";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <RequirePermission tenantSlug={tenantSlug} permission="users:manage">
      <OrganizationSettings tenantSlug={tenantSlug} />
    </RequirePermission>
  );
}
