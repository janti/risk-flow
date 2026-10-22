import { loadTenantAccess } from "@riskflow/auth";
import { createFormVersion, createVersionBodySchema, listFormVersions } from "@riskflow/form-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../../lib/db";
import { formMutationResponse } from "../../../../../../../../lib/form-http";

export const runtime = "nodejs";

const formIdSchema = z.string().uuid();

export async function GET(
  request: Request,
  context: { params: Promise<{ tenantSlug: string; formId: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const { tenantSlug, formId } = await context.params;
  if (!formIdSchema.safeParse(formId).success) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const versions = await listFormVersions(db, access, formId);
  if (typeof versions === "string") {
    return jsonError(
      versions === "not_found" ? 404 : 403,
      versions,
      versions === "not_found"
        ? "Resurssia ei löytynyt."
        : versions === "module_disabled"
          ? "Moduuli ei ole käytössä."
          : "Toiminto ei ole sallittu.",
      requestId,
    );
  }

  return Response.json(ok({ versions }, { requestId }));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ tenantSlug: string; formId: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const { tenantSlug, formId } = await context.params;
  if (!formIdSchema.safeParse(formId).success) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const parsed = createVersionBodySchema.safeParse((await request.json().catch(() => null)) ?? {});
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Lomakeversio on virheellinen.", requestId, parsed.error.flatten());
  }

  const created = await createFormVersion(db, access, formId, parsed.data, requestId);
  if (typeof created === "string") {
    return formMutationResponse(created, requestId);
  }

  return Response.json(ok({ version: created }, { requestId }), { status: 201 });
}
