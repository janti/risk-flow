import { loadTenantAccess } from "@riskflow/auth";
import { getRisk, updateRisk, updateRiskSchema } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../lib/db";
import { riskMutationResponse } from "../../../../../../../lib/risk-http";
import { serviceErrorResponse } from "../../../../../../../lib/service-error";

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

  const risk = await getRisk(db, access, riskId);
  if (typeof risk === "string") {
    return serviceErrorResponse(risk, requestId);
  }

  return Response.json(ok({ risk }, { requestId }));
}

export async function PATCH(
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

  const parsed = updateRiskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Riski on virheellinen.", requestId, parsed.error.flatten());
  }

  const updated = await updateRisk(db, access, riskId, parsed.data, requestId);
  if (typeof updated === "string") {
    return riskMutationResponse(updated, requestId);
  }

  return Response.json(ok({ risk: updated }, { requestId }));
}
