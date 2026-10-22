import { FormEditor } from "../../../../../../../../features/forms/form-editor";
import { RequirePermission } from "../../../../../../../../components/require-permission";

export default async function FormEditPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; formId: string }>;
}) {
  const { tenantSlug, formId } = await params;

  return (
    <RequirePermission tenantSlug={tenantSlug} permission="form:manage">
      <FormEditor tenantSlug={tenantSlug} formId={formId} />
    </RequirePermission>
  );
}
