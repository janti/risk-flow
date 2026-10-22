import { loadTenantAccess } from "@riskflow/auth";
import { createUploadIntent, uploadIntentSchema } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../lib/db";
import { serviceErrorResponse } from "../../../../../../../lib/service-error";

export const runtime = "nodejs";

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

  const parsed = uploadIntentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Liitteen tiedot ovat virheelliset.", requestId, parsed.error.flatten());
  }

  const origin = process.env.AUTH_URL ?? new URL(request.url).origin;
  const result = await createUploadIntent(db, access, parsed.data, origin, requestId);
  if (typeof result === "string") {
    return serviceErrorResponse(result, requestId, "Liitteen tiedot ovat virheelliset.");
  }

  return Response.json(ok(result, { requestId }), { status: 201 });
}
