import {
  clientAddress,
  consumeRateLimit,
  createMemoryRateLimitStore,
  fail,
} from "@riskflow/shared";

const store = createMemoryRateLimitStore();
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trustProxy(): boolean {
  return process.env.RATE_LIMIT_TRUST_PROXY === "true";
}

export function mutationRateLimitResponse(request: Request): Response | null {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
    return null;
  }
  const ip = clientAddress(request, trustProxy());
  const result = consumeRateLimit(
    store,
    `mutation:${ip}`,
    envInt("RATE_LIMIT_MUTATION_MAX", 60),
    envInt("RATE_LIMIT_MUTATION_WINDOW_MS", 60_000),
  );
  if (result.allowed) {
    return null;
  }
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const response = Response.json(
    fail("rate_limited", "Liian monta pyyntöä. Odota hetki ja yritä uudelleen.", { requestId }),
    { status: 429 },
  );
  response.headers.set("Retry-After", String(result.retryAfterSec));
  return response;
}

export function isLoginRateLimited(headers: Headers): boolean {
  const request = new Request("http://127.0.0.1/login", { method: "POST", headers });
  const ip = clientAddress(request, trustProxy());
  const result = consumeRateLimit(
    store,
    `login:${ip}`,
    envInt("RATE_LIMIT_LOGIN_MAX", 10),
    envInt("RATE_LIMIT_LOGIN_WINDOW_MS", 60_000),
  );
  return !result.allowed;
}
