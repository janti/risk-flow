import { loadTenantAccess } from "@riskflow/auth";
import { putAttachmentContent, readAttachmentContent } from "@riskflow/risk-engine";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../../lib/db";
import { serviceErrorResponse } from "../../../../../../../../lib/service-error";

export const runtime = "nodejs";

function signedQuery(request: Request): { exp: number; sig: string } | "invalid" {
  const url = new URL(request.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (!Number.isInteger(exp) || sig.length === 0) {
    return "invalid";
  }
  return { exp, sig };
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ tenantSlug: string; attachmentId: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const signed = signedQuery(request);
  if (signed === "invalid") {
    return jsonError(400, "invalid_query", "Allekirjoitus puuttuu.", requestId);
  }

  const { tenantSlug, attachmentId } = await context.params;
  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const body = new Uint8Array(await request.arrayBuffer());
  const result = await putAttachmentContent(db, access, attachmentId, body, signed.exp, signed.sig, new Date(), requestId);
  if (typeof result === "string") {
    return serviceErrorResponse(result, requestId, "Liitteen lataus on virheellinen.");
  }

  return new Response(null, { status: 204, headers: { "X-Request-Id": requestId } });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ tenantSlug: string; attachmentId: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const signed = signedQuery(request);
  if (signed === "invalid") {
    return jsonError(400, "invalid_query", "Allekirjoitus puuttuu.", requestId);
  }

  const { tenantSlug, attachmentId } = await context.params;
  const db = getAppDatabase();
  const access = await loadTenantAccess(db, { authSubject: user.authSubject, tenantSlug });
  if (!access) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const result = await readAttachmentContent(db, access, attachmentId, signed.exp, signed.sig);
  if (typeof result === "string") {
    return serviceErrorResponse(result, requestId);
  }

  return new Response(Buffer.from(result.body), {
    status: 200,
    headers: {
      "Content-Type": result.attachment.mime,
      "Content-Disposition": `attachment; filename="${result.attachment.filename.replaceAll('"', "")}"`,
      "X-Request-Id": requestId,
    },
  });
}
