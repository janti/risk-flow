import { loadTenantAccess } from "@riskflow/auth";
import { listActions, parseActionListQuery } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../lib/db";
import { workflowMutationResponse } from "../../../../../../lib/workflow-http";

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

  const query = parseActionListQuery(new URL(request.url).searchParams);
  if (query === "invalid") {
    return jsonError(400, "invalid_query", "Hakuehdot ovat virheelliset.", requestId);
  }

  const listed = await listActions(db, access, query);
  if (typeof listed === "string") {
    return workflowMutationResponse(listed, requestId, "Toimenpide on virheellinen.");
  }

  return Response.json(ok({ actions: listed.items }, { requestId, nextCursor: listed.nextCursor }));
}
