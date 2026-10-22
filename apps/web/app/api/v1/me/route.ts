import { listActiveMemberships, updateUserLocale } from "@riskflow/auth";
import { isAppLocale, ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../lib/api-route";
import { getAppDatabase } from "../../../../lib/db";
import { withLocaleCookie } from "../../../../lib/locale";

export const runtime = "nodejs";

const patchMeBody = z.object({
  locale: z.enum(["fi", "sv", "en"]),
});

function serializeUser(user: {
  id: string;
  email: string;
  displayName: string;
  platformAdmin: boolean;
  locale: string;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    platformAdmin: user.platformAdmin,
    locale: user.locale,
  };
}

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const memberships = await listActiveMemberships(getAppDatabase(), user);
  return Response.json(
    ok(
      {
        user: serializeUser(user),
        memberships: memberships.map((membership) => ({
          tenantSlug: membership.tenantSlug,
          tenantName: membership.tenantName,
          status: membership.status,
          roleKeys: membership.roleKeys,
        })),
      },
      { requestId },
    ),
  );
}

export async function PATCH(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const user = await requireAuthenticatedUser(request);
  if (isErrorResponse(user)) {
    return user;
  }

  const parsed = patchMeBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isAppLocale(parsed.data.locale)) {
    return jsonError(400, "invalid_body", "Kieli on virheellinen.", requestId, parsed.error?.flatten());
  }

  const updated = await updateUserLocale(getAppDatabase(), user, parsed.data.locale);
  return withLocaleCookie(
    Response.json(ok({ user: serializeUser(updated) }, { requestId })),
    updated.locale,
  );
}
