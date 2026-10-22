import { RequirePermission } from "../../../../../components/require-permission";
import { ActionsBoard } from "../../../../../features/actions/actions-board";
import { getCurrentTenantAccess } from "../../../../../lib/current-access";

export default async function ActionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const access = await getCurrentTenantAccess(tenantSlug);
  const overdue = query.overdue === "true";
  return (
    <RequirePermission tenantSlug={tenantSlug} permission="risk:read">
      <ActionsBoard
        tenantSlug={tenantSlug}
        canComplete={Boolean(access?.permissionKeys.includes("action:complete"))}
        overdueOnly={overdue}
      />
    </RequirePermission>
  );
}
