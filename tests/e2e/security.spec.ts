import { expect, test } from "@playwright/test";
import { loginToTenant } from "./helpers/oidc-login";

test("GET /health does not leak environment values", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  const body = await response.text();
  expect(body).not.toMatch(/AUTH_SECRET|DATABASE_URL|dev_only/i);
});

test("GET /ready does not leak secrets and reports dependency checks", async ({ request }) => {
  const response = await request.get("/ready");
  const body = (await response.json()) as {
    data?: { status: string; postgres: boolean; redis: boolean };
    error?: { code: string; details?: { postgres?: boolean; redis?: boolean } };
  };
  expect(JSON.stringify(body)).not.toMatch(/AUTH_SECRET|DATABASE_URL|dev_only/i);
  if (response.ok()) {
    expect(body.data?.status).toBe("ok");
    expect(body.data?.postgres).toBe(true);
    expect(body.data?.redis).toBe(true);
  } else {
    expect(response.status()).toBe(503);
    expect(body.error?.code).toBe("service_unavailable");
  }
});

test("two pilot tenants stay isolated after UI login", async ({ page }) => {
  await loginToTenant(page, "acme-admin", "acme");
  await expect(page.getByTestId("user-name")).toContainText("Acme Admin");
  const denied = await page.request.get("/t/globex/home");
  expect(denied.status()).toBe(404);
});
