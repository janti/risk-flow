import { loadTenantAccess } from "@riskflow/auth";
import { createAssessment, createAssessmentSchema, listAssessments } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../../lib/db";
import { riskMutationResponse } from "../../../../../../../../lib/risk-http";
import { serviceErrorResponse } from "../../../../../../../../lib/service-error";

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

  const listed = await listAssessments(db, access, riskId);
  if (typeof listed === "string") {
    return serviceErrorResponse(listed, requestId, "Arviointi on virheellinen.");
  }

  return Response.json(ok(listed, { requestId }));
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

  const parsed = createAssessmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Arviointi on virheellinen.", requestId, parsed.error.flatten());
  }

  const created = await createAssessment(db, access, riskId, parsed.data, requestId);
  if (typeof created === "string") {
    return riskMutationResponse(created, requestId);
  }

  return Response.json(ok({ assessment: created }, { requestId }), { status: 201 });
}
