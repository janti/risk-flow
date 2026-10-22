export function resolveRequestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  if (!host) {
    return null;
  }
  const protocol = forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}

export function isSameOrigin(request: Request, canonicalOrigin: string): boolean {
  const requestOrigin = resolveRequestOrigin(request);
  if (!requestOrigin) {
    return false;
  }
  try {
    return requestOrigin === new URL(canonicalOrigin).origin;
  } catch {
    return false;
  }
}

export function assertSafeMutation(request: Request, canonicalOrigin: string): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }
  if (!isSameOrigin(request, canonicalOrigin)) {
    throw new Error("CSRF_REJECTED");
  }
}
