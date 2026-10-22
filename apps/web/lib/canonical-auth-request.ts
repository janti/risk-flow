import { NextRequest } from "next/server";

export function resolveAuthOrigin(): string {
  const value = process.env.AUTH_URL;
  return value && value.length > 0 ? value : "http://127.0.0.1:3000";
}

/**
 * Auth.js builds the OIDC redirect_uri from the incoming request URL and
 * x-forwarded-host. Local browsers and Next.js may report localhost while
 * the authorization request used 127.0.0.1, which oidc-provider rejects.
 */
export function withCanonicalAuthOrigin(request: NextRequest): NextRequest {
  const origin = resolveAuthOrigin();
  process.env.AUTH_URL = origin;

  const canonical = new URL(origin);
  const nextUrl = new URL(request.url);
  nextUrl.protocol = canonical.protocol;
  nextUrl.host = canonical.host;

  const headers = new Headers(request.headers);
  headers.set("host", canonical.host);
  headers.set("x-forwarded-host", canonical.host);
  headers.set("x-forwarded-proto", canonical.protocol.replace(":", ""));

  const webRequest = new Request(nextUrl, {
    method: request.method,
    headers,
    ...(request.method === "GET" || request.method === "HEAD"
      ? {}
      : { body: request.body, duplex: "half" as const }),
  });

  const canonicalRequest = new NextRequest(webRequest);
  Object.defineProperty(canonicalRequest, "url", {
    configurable: true,
    get: () => nextUrl.toString(),
  });
  Object.defineProperty(canonicalRequest, "nextUrl", {
    configurable: true,
    get: () => nextUrl,
  });
  return canonicalRequest;
}
