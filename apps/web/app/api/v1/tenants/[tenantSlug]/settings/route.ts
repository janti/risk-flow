import {
  getTenantSettings,
  loadTenantAccess,
  patchTenantSettings,
  patchTenantSettingsSchema,
} from "@riskflow/auth";
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

  const settings = await getTenantSettings(db, access);
  if (typeof settings === "string") {
    return serviceErrorResponse(settings, requestId);
  }

  return Response.json(ok({ settings }, { requestId }));
}

export async function PATCH(
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

  const parsed = patchTenantSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Asetukset ovat virheelliset.", requestId, parsed.error.flatten());
  }

  const updated = await patchTenantSettings(db, access, parsed.data);
  if (typeof updated === "string") {
    return serviceErrorResponse(updated, requestId, "Asetukset ovat virheelliset.");
  }

  return Response.json(ok({ settings: updated }, { requestId }));
}
