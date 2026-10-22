import { authorize } from "@riskflow/auth";
import type { PermissionKey } from "@riskflow/permissions";
import type { ReactNode } from "react";
import { getCurrentTenantAccess } from "../lib/current-access";
import { AccessDenied } from "./access-denied";

export async function RequirePermission({
  tenantSlug,
  permission,
  children,
}: {
  tenantSlug: string;
  permission: PermissionKey;
  children: ReactNode;
}) {
  const access = await getCurrentTenantAccess(tenantSlug);
  if (!access || !authorize(access, permission)) {
    return <AccessDenied />;
  }
  return children;
}
