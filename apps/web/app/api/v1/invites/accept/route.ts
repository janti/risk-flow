import { acceptInvitation } from "@riskflow/auth";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(16),
});

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  const result = await acceptInvitation(getAppDatabase(), user, parsed.data.token);
  if (result !== "accepted") {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }

  return Response.json(ok({ accepted: true }, { requestId }));
}
