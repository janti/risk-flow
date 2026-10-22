import { RequirePermission } from "../../../../../../components/require-permission";
import { RiskForm } from "../../../../../../features/risks/risk-form";

export default async function NewRiskPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  return (
    <RequirePermission tenantSlug={tenantSlug} permission="risk:create">
      <RiskForm tenantSlug={tenantSlug} mode="create" />
    </RequirePermission>
  );
}
