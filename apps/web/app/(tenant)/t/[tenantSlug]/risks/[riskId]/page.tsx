import { RequirePermission } from "../../../../../../components/require-permission";
import { RiskDetail } from "../../../../../../features/risks/risk-detail";
import { getCurrentTenantAccess } from "../../../../../../lib/current-access";

export default async function RiskDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; riskId: string }>;
}) {
  const { tenantSlug, riskId } = await params;
  const access = await getCurrentTenantAccess(tenantSlug);

  return (
    <RequirePermission tenantSlug={tenantSlug} permission="risk:read">
      <RiskDetail
        tenantSlug={tenantSlug}
        riskId={riskId}
        membershipId={access?.membership.id ?? ""}
        permissions={{
          create: Boolean(access?.permissionKeys.includes("risk:create")),
          update: Boolean(access?.permissionKeys.includes("risk:update")),
          archive: Boolean(access?.permissionKeys.includes("risk:archive")),
          assess: Boolean(access?.permissionKeys.includes("risk:assess")),
          assign: Boolean(access?.permissionKeys.includes("action:assign")),
          complete: Boolean(access?.permissionKeys.includes("action:complete")),
          approve: Boolean(access?.permissionKeys.includes("risk:approve")),
        }}
      />
    </RequirePermission>
  );
}
