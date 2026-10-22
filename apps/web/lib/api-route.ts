import { assertSafeMutation, findUserByAuthSubject, type AuthenticatedUser } from "@riskflow/auth";
import { fail } from "@riskflow/shared";
import { auth } from "../auth";
import { getAppDatabase } from "./db";
import { mutationRateLimitResponse } from "./rate-limit";

export function requestIdFrom(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
): Response {
  return Response.json(fail(code, message, { requestId, details }), { status });
}

export async function requireAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedUser | Response> {
  const requestId = requestIdFrom(request);
  const limited = mutationRateLimitResponse(request);
  if (limited) {
    return limited;
  }
  const origin = process.env.AUTH_URL ?? new URL(request.url).origin;
  try {
    assertSafeMutation(request, origin);
  } catch {
    return jsonError(403, "csrf_rejected", "Pyyntö hylättiin.", requestId);
  }

  const session = await auth();
  const authSubject = session?.user?.authSubject;
  if (!authSubject) {
    return jsonError(401, "unauthenticated", "Kirjautuminen vaaditaan.", requestId);
  }

  const user = await findUserByAuthSubject(getAppDatabase(), authSubject);
  if (!user) {
    return jsonError(401, "unauthenticated", "Kirjautuminen vaaditaan.", requestId);
  }
  return user;
}

export function isErrorResponse(value: AuthenticatedUser | Response): value is Response {
  return value instanceof Response;
}

export async function timed<T>(work: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const started = performance.now();
  const value = await work();
  return { value, durationMs: Math.round(performance.now() - started) };
}

export function withServerTiming(response: Response, durationMs: number, metric = "app"): Response {
  response.headers.set("Server-Timing", `${metric};dur=${durationMs}`);
  return response;
}
