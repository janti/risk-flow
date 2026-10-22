import { loadTenantAccess } from "@riskflow/auth";
import { decideApproval, decideApprovalSchema } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../../lib/db";
import { workflowMutationResponse } from "../../../../../../../../lib/workflow-http";

export const runtime = "nodejs";

const riskIdSchema = z.string().uuid();

export async function POST(
  request: Request,
  context: { params: Promise<{ tenantSlug: string; riskId: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const { tenantSlug, riskId } = await context.params;
  if (!riskIdSchema.safeParse(riskId).success) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const parsed = decideApprovalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Hyväksyntä on virheellinen.", requestId, parsed.error.flatten());
  }

  const decided = await decideApproval(db, access, riskId, parsed.data, requestId);
  if (typeof decided === "string") {
    return workflowMutationResponse(decided, requestId, "Hyväksyntä on virheellinen.");
  }

  return Response.json(ok(decided, { requestId }), { status: 201 });
}
