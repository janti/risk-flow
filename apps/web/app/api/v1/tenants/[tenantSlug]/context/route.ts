import { loadTenantAccess } from "@riskflow/auth";
import { ok } from "@riskflow/shared";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../lib/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ tenantSlug: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const { tenantSlug } = await context.params;
  const access = await loadTenantAccess(getAppDatabase(), {
    authSubject: user.authSubject,
    tenantSlug,
  });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  return Response.json(
    ok(
      {
        tenant: {
          slug: access.tenant.slug,
          name: access.tenant.name,
          status: access.tenant.status,
          locale: access.tenant.locale,
          timezone: access.tenant.timezone,
          branding: access.tenant.branding,
        },
        membershipId: access.membership.id,
        roleKeys: access.roleKeys,
        permissions: access.permissionKeys,
        orgUnitScope: access.orgUnitScope === "tenant" ? "tenant" : [...access.orgUnitScope],
        modules: access.enabledModules,
      },
      { requestId },
    ),
  );
}
