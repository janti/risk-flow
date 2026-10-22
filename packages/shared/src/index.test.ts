import { describe, expect, it } from "vitest";
import { fail, isTenantSlug, ok } from "./index";

describe("isTenantSlug", () => {
  it("accepts lowercase hyphenated slugs", () => {
    expect(isTenantSlug("acme")).toBe(true);
    expect(isTenantSlug("acme-corp")).toBe(true);
  });

  it("rejects invalid slugs", () => {
    expect(isTenantSlug("Acme")).toBe(false);
    expect(isTenantSlug("-acme")).toBe(false);
    expect(isTenantSlug("acme-")).toBe(false);
    expect(isTenantSlug("")).toBe(false);
  });
});

describe("API envelopes", () => {
  it("wraps successful payloads", () => {
    expect(ok({ status: "ok" })).toEqual({ data: { status: "ok" }, meta: {} });
  });

  it("wraps typed errors", () => {
    expect(fail("FORBIDDEN", "Not allowed", { requestId: "req-1" })).toEqual({
      error: { code: "FORBIDDEN", message: "Not allowed", details: undefined, requestId: "req-1" },
    });
  });
});
