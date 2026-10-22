import { expect, test } from "@playwright/test";

test("GET /health returns a success envelope", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as {
    data: { status: string; timestamp: string };
    meta: Record<string, unknown>;
  };

  expect(body.data.status).toBe("ok");
  expect(body.data.timestamp).toBeTruthy();
});
