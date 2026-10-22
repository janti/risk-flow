import { ModuleToggleList } from "../../../../../../features/settings/module-toggle-list";
import { RequirePermission } from "../../../../../../components/require-permission";

export default async function ModulesSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <RequirePermission tenantSlug={tenantSlug} permission="module:manage">
      <ModuleToggleList tenantSlug={tenantSlug} />
    </RequirePermission>
  );
}
