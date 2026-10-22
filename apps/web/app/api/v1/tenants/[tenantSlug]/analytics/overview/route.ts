import { loadTenantAccess } from "@riskflow/auth";
import { getAnalyticsOverview, parseOverviewQuery } from "@riskflow/analytics";
import { ok } from "@riskflow/shared";
import {
  isErrorResponse,
  jsonError,
  requestIdFrom,
  requireAuthenticatedUser,
  timed,
  withServerTiming,
} from "../../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../../lib/db";

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

  const query = parseOverviewQuery(new URL(request.url).searchParams);
  if (query === "invalid") {
    return jsonError(400, "invalid_query", "Hakuehdot ovat virheelliset.", requestId);
  }

  const { value: overview, durationMs } = await timed(() => getAnalyticsOverview(db, access, query));
  if (overview === "module_disabled") {
    return jsonError(403, "module_disabled", "Moduuli ei ole käytössä.", requestId);
  }
  if (overview === "forbidden") {
    return jsonError(403, "forbidden", "Toiminto ei ole sallittu.", requestId);
  }
  if (overview === "invalid") {
    return jsonError(400, "invalid_query", "Aikaväli on virheellinen.", requestId);
  }

  return withServerTiming(Response.json(ok({ overview }, { requestId, durationMs })), durationMs, "overview");
}
