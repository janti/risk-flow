import { loadTenantAccess } from "@riskflow/auth";
import { markNotificationRead } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../lib/db";
import { serviceErrorResponse } from "../../../../../../../lib/service-error";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tenantSlug: string; notificationId: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const { tenantSlug, notificationId } = await context.params;
  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const result = await markNotificationRead(db, access, notificationId);
  if (typeof result === "string") {
    return serviceErrorResponse(result, requestId);
  }

  return Response.json(ok({ notification: result }, { requestId }));
}
