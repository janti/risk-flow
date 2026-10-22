import { listRoleMatrix, loadTenantAccess, patchRoleMatrix, patchRolesSchema } from "@riskflow/auth";
import { PERMISSION_KEYS } from "@riskflow/permissions";
import { ok } from "@riskflow/shared";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../lib/db";
import { serviceErrorResponse } from "../../../../../../lib/service-error";

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
  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const roles = await listRoleMatrix(db, access);
  if (typeof roles === "string") {
    return serviceErrorResponse(roles, requestId);
  }

  return Response.json(ok({ roles, permissionKeys: PERMISSION_KEYS }, { requestId }));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tenantSlug: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const { tenantSlug } = await context.params;
  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const parsed = patchRolesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Roolimatriisi on virheellinen.", requestId, parsed.error.flatten());
  }

  const updated = await patchRoleMatrix(db, access, parsed.data, requestId);
  if (typeof updated === "string") {
    return serviceErrorResponse(updated, requestId, "Roolimatriisi on virheellinen.");
  }

  return Response.json(ok({ roles: updated, permissionKeys: PERMISSION_KEYS }, { requestId }));
}
