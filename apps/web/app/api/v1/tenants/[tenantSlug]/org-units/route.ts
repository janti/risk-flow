import {
  createOrgUnit,
  createOrgUnitSchema,
  listOrgUnits,
  loadTenantAccess,
  patchOrgUnit,
  patchOrgUnitSchema,
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

  const units = await listOrgUnits(db, access);
  if (typeof units === "string") {
    return serviceErrorResponse(units, requestId);
  }

  return Response.json(ok({ orgUnits: units }, { requestId }));
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

  const parsed = createOrgUnitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Organisaatioyksikkö on virheellinen.", requestId, parsed.error.flatten());
  }

  const created = await createOrgUnit(db, access, parsed.data);
  if (typeof created === "string") {
    return serviceErrorResponse(created, requestId, "Organisaatioyksikkö on virheellinen.");
  }

  return Response.json(ok({ orgUnits: created }, { requestId }), { status: 201 });
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

  const parsed = patchOrgUnitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Organisaatioyksikkö on virheellinen.", requestId, parsed.error.flatten());
  }

  const updated = await patchOrgUnit(db, access, parsed.data);
  if (typeof updated === "string") {
    return serviceErrorResponse(updated, requestId, "Organisaatioyksikkö on virheellinen.");
  }

  return Response.json(ok({ orgUnits: updated }, { requestId }));
}
