import { RequirePermission } from "../../../../../components/require-permission";
import { RiskRegister } from "../../../../../features/risks/risk-register";
import { getCurrentTenantAccess } from "../../../../../lib/current-access";

export default async function RisksPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const access = await getCurrentTenantAccess(tenantSlug);
  const read = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value : "";
  };

  return (
    <RequirePermission tenantSlug={tenantSlug} permission="risk:read">
      <RiskRegister
        tenantSlug={tenantSlug}
        permissions={{
          create: Boolean(access?.permissionKeys.includes("risk:create")),
          update: Boolean(access?.permissionKeys.includes("risk:update")),
          archive: Boolean(access?.permissionKeys.includes("risk:archive")),
          assess: Boolean(access?.permissionKeys.includes("risk:assess")),
          assign: Boolean(access?.permissionKeys.includes("action:assign")),
          complete: Boolean(access?.permissionKeys.includes("action:complete")),
          approve: Boolean(access?.permissionKeys.includes("risk:approve")),
        }}
        initialFilters={{
          assessmentType: read("assessmentType") === "inherent" ? "inherent" : "residual",
          likelihood: read("likelihood"),
          impact: read("impact"),
          status: read("status"),
          categoryId: read("categoryId"),
          createdFrom: read("createdFrom"),
          createdTo: read("createdTo"),
        }}
      />
    </RequirePermission>
  );
}
