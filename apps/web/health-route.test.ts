import { describe, expect, it } from "vitest";
import { GET } from "./app/health/route";

describe("GET /health", () => {
  it("returns a typed success envelope without secrets", async () => {
    const response = GET();
    const body = (await response.json()) as {
      data: { status: string; timestamp: string };
      meta: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ok");
    expect(typeof body.data.timestamp).toBe("string");
    expect(JSON.stringify(body)).not.toMatch(/password|secret|DATABASE_URL/i);
  });
});
