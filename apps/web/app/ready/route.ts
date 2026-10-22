import { fail, ok } from "@riskflow/shared";
import { checkReadiness } from "../../lib/ready";

export async function GET(): Promise<Response> {
  const checks = await checkReadiness();
  const ready = checks.postgres && checks.redis;
  const timestamp = new Date().toISOString();
  const headers = { "Cache-Control": "no-store" };
  if (!ready) {
    return Response.json(fail("service_unavailable", "Palvelu ei ole valmis.", { details: { ...checks, timestamp } }), {
      status: 503,
      headers,
    });
  }
  return Response.json(ok({ status: "ok" as const, timestamp, ...checks }), { headers });
}
