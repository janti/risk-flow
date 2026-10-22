import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "./security-headers";

describe("security headers", () => {
  it("includes CSP and clickjacking controls in development without HSTS", () => {
    const headers = buildSecurityHeaders({
      APP_ENV: "development",
      AUTH_ISSUER: "http://127.0.0.1:3300",
    });
    const map = Object.fromEntries(headers.map((header) => [header.key, header.value]));
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(map["Content-Security-Policy"]).toContain("unsafe-eval");
    expect(map["Content-Security-Policy"]).toContain("form-action 'self' http://127.0.0.1:3300");
    expect(map["Strict-Transport-Security"]).toBeUndefined();
  });

  it("adds HSTS only in production", () => {
    const headers = buildSecurityHeaders({ APP_ENV: "production" });
    const map = Object.fromEntries(headers.map((header) => [header.key, header.value]));
    expect(map["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
    expect(map["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
    expect(map["Content-Security-Policy"]).not.toContain("unsafe-eval");
  });
});
