import { loadTenantAccess } from "@riskflow/auth";
import { listTenantModules, patchModulesSchema, patchTenantModules } from "@riskflow/module-registry";
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

  const modules = await listTenantModules(db, access);
  if (typeof modules === "string") {
    return serviceErrorResponse(modules, requestId);
  }

  return Response.json(ok({ modules }, { requestId }));
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

  const parsed = patchModulesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Moduulipäivitys on virheellinen.", requestId, parsed.error.flatten());
  }

  const updated = await patchTenantModules(db, access, parsed.data, requestId);
  if (typeof updated === "string") {
    return serviceErrorResponse(updated, requestId, "Moduulipäivitys on virheellinen.");
  }

  return Response.json(ok({ modules: updated }, { requestId }));
}
