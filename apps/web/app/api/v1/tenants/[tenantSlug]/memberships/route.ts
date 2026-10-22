import { addMemberDirectly, createInvitation, listTenantMemberships, loadTenantAccess } from "@riskflow/auth";
import { ok } from "@riskflow/shared";
import { z } from "zod";
import { isErrorResponse, jsonError, requestIdFrom, requireAuthenticatedUser } from "../../../../../../lib/api-route";
import { getAppDatabase } from "../../../../../../lib/db";

export const runtime = "nodejs";

const membershipWriteSchema = z.object({
  mode: z.enum(["invite", "direct"]).default("invite"),
  email: z.string().email(),
  roleKey: z.string(),
  orgUnitId: z.string().uuid().optional(),
  displayName: z.string().min(1).max(120).optional(),
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

  const members = await listTenantMemberships(db, access);
  if (members === "forbidden") {
    return jsonError(403, "forbidden", "Toiminto ei ole sallittu.", requestId);
  }

  return Response.json(ok({ memberships: members }, { requestId }));
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

  const parsed = membershipWriteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Kutsu on virheellinen.", requestId, parsed.error.flatten());
  }

  if (parsed.data.mode === "direct") {
    const created = await addMemberDirectly(db, access, parsed.data);
    if (created === "forbidden") {
      return jsonError(403, "forbidden", "Toiminto ei ole sallittu.", requestId);
    }
    if (created === "invalid") {
      return jsonError(400, "invalid_body", "Jäsenyys on virheellinen.", requestId);
    }
    if (created === "conflict") {
      return jsonError(409, "conflict", "Käyttäjä on jo tämän tenantin jäsen.", requestId);
    }
    return Response.json(ok({ membership: created }, { requestId }), { status: 201 });
  }

  const created = await createInvitation(db, access, parsed.data);
  if (created === "forbidden") {
    return jsonError(403, "forbidden", "Toiminto ei ole sallittu.", requestId);
  }
  if (created === "invalid") {
    return jsonError(400, "invalid_body", "Kutsu on virheellinen.", requestId);
  }
  if (created === "conflict") {
    return jsonError(409, "conflict", "Avoin kutsu tälle sähköpostille on jo olemassa.", requestId);
  }

  const origin = process.env.AUTH_URL ?? new URL(request.url).origin;
  return Response.json(
    ok(
      {
        invitation: {
          id: created.id,
          email: created.email,
          roleKey: created.roleKey,
          expiresAt: created.expiresAt,
          acceptUrl: `${origin}/invite/${created.token}`,
        },
      },
      { requestId },
    ),
    { status: 201 },
  );
}
