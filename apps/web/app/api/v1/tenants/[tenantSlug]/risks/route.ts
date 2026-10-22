import { loadTenantAccess } from "@riskflow/auth";
import { createRisk, createRiskSchema, listRisks, parseRiskListQuery } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import {
  isErrorResponse,
  jsonError,
  requestIdFrom,
  requireAuthenticatedUser,
  timed,
  withServerTiming,
} from "../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../lib/db";
import { riskMutationResponse } from "../../../../../../lib/risk-http";
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

  const query = parseRiskListQuery(new URL(request.url).searchParams);
  if (query === "invalid") {
    return jsonError(400, "invalid_query", "Hakuehdot ovat virheelliset.", requestId);
  }

  const { value: listed, durationMs } = await timed(() => listRisks(db, access, query));
  if (typeof listed === "string") {
    return serviceErrorResponse(listed, requestId);
  }

  return withServerTiming(
    Response.json(
      ok(
        { risks: listed.items },
        { requestId, nextCursor: listed.nextCursor, limit: listed.limit, durationMs },
      ),
    ),
    durationMs,
    "listRisks",
  );
}

export async function POST(
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

  const parsed = createRiskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Riski on virheellinen.", requestId, parsed.error.flatten());
  }

  const created = await createRisk(db, access, parsed.data, requestId);
  if (typeof created === "string") {
    return riskMutationResponse(created, requestId);
  }

  return Response.json(ok({ risk: created }, { requestId }), { status: 201 });
}
