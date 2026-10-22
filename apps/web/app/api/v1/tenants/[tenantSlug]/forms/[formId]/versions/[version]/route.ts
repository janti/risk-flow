import { loadTenantAccess } from "@riskflow/auth";
import { previewFormImpact, saveDraftBodySchema, saveFormDraft } from "@riskflow/form-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../../../lib/db";
import { formMutationResponse } from "../../../../../../../../../lib/form-http";

export const runtime = "nodejs";

const formIdSchema = z.string().uuid();
const versionSchema = z.coerce.number().int().positive();

export async function GET(
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

  const preview = await previewFormImpact(db, access, formId, parsedVersion.data);
  if (typeof preview === "string") {
    return formMutationResponse(preview, requestId);
  }

  return Response.json(ok(preview, { requestId }));
}

export async function PATCH(
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

  const parsed = saveDraftBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Lomake on virheellinen.", requestId, parsed.error.flatten());
  }

  const saved = await saveFormDraft(db, access, formId, parsedVersion.data, parsed.data, requestId);
  if (typeof saved === "string") {
    return formMutationResponse(saved, requestId);
  }

  return Response.json(ok({ version: saved }, { requestId }));
}
