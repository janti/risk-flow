import { loadTenantAccess } from "@riskflow/auth";
import { publishFormVersion } from "@riskflow/form-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../../../../lib/db";
import { formMutationResponse } from "../../../../../../../../../../lib/form-http";

export const runtime = "nodejs";

const formIdSchema = z.string().uuid();
const versionSchema = z.coerce.number().int().positive();

export async function POST(
  request: Request,
  context: { params: Promise<{ tenantSlug: string; formId: string; version: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const { tenantSlug, formId, version } = await context.params;
  const parsedVersion = versionSchema.safeParse(version);
  if (!formIdSchema.safeParse(formId).success || !parsedVersion.success) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const published = await publishFormVersion(db, access, formId, parsedVersion.data, requestId);
  if (typeof published === "string") {
    return formMutationResponse(published, requestId);
  }

  return Response.json(ok(published, { requestId }));
}
