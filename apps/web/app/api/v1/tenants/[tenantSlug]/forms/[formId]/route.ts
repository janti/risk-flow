import { loadTenantAccess } from "@riskflow/auth";
import { getForm } from "@riskflow/form-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../lib/db";

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

  const form = await getForm(db, access, formId);
  if (typeof form === "string") {
    return jsonError(
      form === "not_found" ? 404 : 403,
      form,
      form === "not_found"
        ? "Resurssia ei löytynyt."
        : form === "module_disabled"
          ? "Moduuli ei ole käytössä."
          : "Toiminto ei ole sallittu.",
      requestId,
    );
  }

  return Response.json(ok({ form }, { requestId }));
}
