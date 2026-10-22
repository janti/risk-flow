import { loadTenantAccess } from "@riskflow/auth";
import { createAction, createActionSchema, listActions } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../../lib/db";
import { workflowMutationResponse } from "../../../../../../../../lib/workflow-http";

export const runtime = "nodejs";

const riskIdSchema = z.string().uuid();

export async function GET(
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

  const listed = await listActions(db, access, { limit: 100, riskId, mine: false, overdue: false });
  if (typeof listed === "string") {
    return workflowMutationResponse(listed, requestId, "Toimenpide on virheellinen.");
  }

  return Response.json(ok({ actions: listed.items }, { requestId, nextCursor: listed.nextCursor }));
}

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

  const parsed = createActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Toimenpide on virheellinen.", requestId, parsed.error.flatten());
  }

  const created = await createAction(db, access, riskId, parsed.data, requestId);
  if (typeof created === "string") {
    return workflowMutationResponse(created, requestId, "Toimenpide on virheellinen.");
  }

  return Response.json(ok({ action: created }, { requestId }), { status: 201 });
}
