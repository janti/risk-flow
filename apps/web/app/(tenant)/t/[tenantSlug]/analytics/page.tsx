import { RequirePermission } from "../../../../../components/require-permission";
import { AnalyticsBoard } from "../../../../../features/dashboards/analytics-board";

export default async function AnalyticsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  return (
    <RequirePermission tenantSlug={tenantSlug} permission="analytics:read">
      <AnalyticsBoard tenantSlug={tenantSlug} variant="full" />
    </RequirePermission>
  );
}
