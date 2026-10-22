import { loadTenantAccess } from "@riskflow/auth";
import { updateAction, updateActionSchema } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../lib/db";
import { workflowMutationResponse } from "../../../../../../../lib/workflow-http";

export const runtime = "nodejs";

const actionIdSchema = z.string().uuid();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tenantSlug: string; actionId: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const { tenantSlug, actionId } = await context.params;
  if (!actionIdSchema.safeParse(actionId).success) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const parsed = updateActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Toimenpide on virheellinen.", requestId, parsed.error.flatten());
  }

  const updated = await updateAction(db, access, actionId, parsed.data, requestId);
  if (typeof updated === "string") {
    return workflowMutationResponse(updated, requestId, "Toimenpide on virheellinen.");
  }

  return Response.json(ok({ action: updated }, { requestId }));
}
