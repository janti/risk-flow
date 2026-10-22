import { parseAppEnvironment, type AppEnvironment } from "./runtime-env";

export type HeaderPair = { key: string; value: string };

export function buildSecurityHeaders(
  env: Record<string, string | undefined> = process.env,
): HeaderPair[] {
  const appEnv = parseAppEnvironment(env.APP_ENV ?? env.NODE_ENV);
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy", value: contentSecurityPolicy(appEnv, env) },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ...hstsHeaders(appEnv),
  ];
}

function issuerOrigin(env: Record<string, string | undefined>): string | null {
  const issuer = env.AUTH_ISSUER;
  if (!issuer) {
    return null;
  }
  try {
    return new URL(issuer).origin;
  } catch {
    return null;
  }
}

function contentSecurityPolicy(
  appEnv: AppEnvironment,
  env: Record<string, string | undefined>,
): string {
  const scriptSrc =
    appEnv === "development" ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
  const issuer = issuerOrigin(env);
  const connectSrc = issuer ? `'self' ${issuer}` : "'self'";
  const formAction = issuer ? `'self' ${issuer}` : "'self'";
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action ${formAction}`,
    "object-src 'none'",
  ];
  if (appEnv !== "development") {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

function hstsHeaders(appEnv: AppEnvironment): HeaderPair[] {
  if (appEnv !== "production") {
    return [];
  }
  return [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }];
}
