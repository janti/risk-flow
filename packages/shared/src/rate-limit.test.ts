import { describe, expect, it } from "vitest";
import { clientAddress, consumeRateLimit, createMemoryRateLimitStore } from "./rate-limit";

describe("rate limit", () => {
  it("allows traffic under the limit and then blocks", () => {
    const store = createMemoryRateLimitStore();
    const first = consumeRateLimit(store, "ip:1", 2, 60_000);
    const second = consumeRateLimit(store, "ip:1", 2, 60_000);
    const third = consumeRateLimit(store, "ip:1", 2, 60_000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates keys", () => {
    const store = createMemoryRateLimitStore();
    consumeRateLimit(store, "a", 1, 60_000);
    const other = consumeRateLimit(store, "b", 1, 60_000);
    expect(other.allowed).toBe(true);
  });

  it("reads the first forwarded address only when the proxy is trusted", () => {
    const request = new Request("http://127.0.0.1/api", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientAddress(request, false)).toBe("local");
    expect(clientAddress(request, true)).toBe("203.0.113.9");
  });
});
