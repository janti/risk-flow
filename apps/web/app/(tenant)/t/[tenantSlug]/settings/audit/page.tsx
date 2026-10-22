import { AuditEventList } from "../../../../../../features/audit/audit-event-list";
import { RequirePermission } from "../../../../../../components/require-permission";

export default async function AuditSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <RequirePermission tenantSlug={tenantSlug} permission="audit:read">
      <AuditEventList tenantSlug={tenantSlug} />
    </RequirePermission>
  );
}
