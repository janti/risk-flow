import { ok } from "@riskflow/shared";

export function GET(): Response {
  return Response.json(ok({ status: "ok" as const, timestamp: new Date().toISOString() }), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
