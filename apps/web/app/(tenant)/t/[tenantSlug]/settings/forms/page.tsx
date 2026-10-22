import { FormList } from "../../../../../../features/forms/form-list";
import { RequirePermission } from "../../../../../../components/require-permission";

export default async function FormsSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <RequirePermission tenantSlug={tenantSlug} permission="form:manage">
      <FormList tenantSlug={tenantSlug} />
    </RequirePermission>
  );
}
