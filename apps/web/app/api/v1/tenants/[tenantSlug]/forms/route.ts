import { loadTenantAccess } from "@riskflow/auth";
import { createForm, createFormBodySchema, listForms } from "@riskflow/form-engine";
import { ok } from "@riskflow/shared";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../lib/db";
import { formMutationResponse } from "../../../../../../lib/form-http";

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

  const forms = await listForms(db, access);
  if (typeof forms === "string") {
    return jsonError(
      403,
      forms,
      forms === "module_disabled" ? "Moduuli ei ole käytössä." : "Toiminto ei ole sallittu.",
      requestId,
    );
  }

  return Response.json(ok({ forms }, { requestId }));
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

  const parsed = createFormBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Lomake on virheellinen.", requestId, parsed.error.flatten());
  }

  const created = await createForm(db, access, parsed.data, requestId);
  if (typeof created === "string") {
    return formMutationResponse(created, requestId);
  }

  return Response.json(ok({ form: created }, { requestId }), { status: 201 });
}
