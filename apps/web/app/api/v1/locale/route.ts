import { assertSafeMutation, findUserByAuthSubject, updateUserLocale } from "@riskflow/auth";
import { isAppLocale, ok } from "@riskflow/shared";
import { z } from "zod";
import { auth } from "../../../../auth";
import { jsonError, requestIdFrom } from "../../../../lib/api-route";
import { getAppDatabase } from "../../../../lib/db";
import { withLocaleCookie } from "../../../../lib/locale";

export const runtime = "nodejs";

const localeBody = z.object({
  locale: z.enum(["fi", "sv", "en"]),
});

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  const origin = process.env.AUTH_URL ?? new URL(request.url).origin;
  try {
    assertSafeMutation(request, origin);
  } catch {
    return jsonError(403, "csrf_rejected", "Pyyntö hylättiin.", requestId);
  }

  const parsed = localeBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isAppLocale(parsed.data.locale)) {
    return jsonError(400, "invalid_body", "Kieli on virheellinen.", requestId, parsed.error?.flatten());
  }

  const locale = parsed.data.locale;
  const session = await auth();
  const authSubject = session?.user?.authSubject;
  if (authSubject) {
    const user = await findUserByAuthSubject(getAppDatabase(), authSubject);
    if (user) {
      const updated = await updateUserLocale(getAppDatabase(), user, locale);
      return withLocaleCookie(Response.json(ok({ locale: updated.locale }, { requestId })), updated.locale);
    }
  }

  return withLocaleCookie(Response.json(ok({ locale }, { requestId })), locale);
}
