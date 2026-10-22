import { loadTenantAccess } from "@riskflow/auth";
import { listIncidents } from "@riskflow/module-registry";
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

  const listed = await listIncidents(access);
  if (typeof listed === "string") {
    return serviceErrorResponse(listed, requestId);
  }

  return Response.json(ok(listed, { requestId }));
}
