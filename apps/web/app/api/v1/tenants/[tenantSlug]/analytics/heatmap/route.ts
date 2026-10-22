import { authorize, loadTenantAccess } from "@riskflow/auth";
import { getAssessmentHeatmap } from "@riskflow/risk-engine";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../lib/db";

export const runtime = "nodejs";

const querySchema = z.object({
  assessmentType: z.enum(["inherent", "residual"]).default("residual"),
});

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
  if (!authorize(access, "analytics:read")) {
    return jsonError(403, "forbidden", "Toiminto ei ole sallittu.", requestId);
  }

  const parsed = querySchema.safeParse({
    assessmentType: new URL(request.url).searchParams.get("assessmentType") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(400, "invalid_query", "Hakuehdot ovat virheelliset.", requestId);
  }

  const heatmap = await getAssessmentHeatmap(db, access, parsed.data.assessmentType);
  if (heatmap === "module_disabled" || heatmap === "forbidden") {
    return jsonError(
      403,
      heatmap,
      heatmap === "module_disabled" ? "Moduuli ei ole käytössä." : "Toiminto ei ole sallittu.",
      requestId,
    );
  }
  if (typeof heatmap === "string") {
    return jsonError(400, "invalid_query", "Pisteytysmallia ei löytynyt.", requestId);
  }

  return Response.json(ok({ heatmap }, { requestId }));
}
