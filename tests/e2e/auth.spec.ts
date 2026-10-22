import { expect, test } from "@playwright/test";
import { loginToTenant, loginWithOidc } from "./helpers/oidc-login";

test("unauthenticated tenant routes redirect to login", async ({ page }) => {
  await page.goto("/t/acme/home");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId("login-oidc")).toBeVisible();
});

test("GET /api/v1/me without a session returns 401", async ({ request }) => {
  const response = await request.get("/api/v1/me");
  expect(response.status()).toBe(401);
  const body = (await response.json()) as { error: { code: string } };
  expect(body.error.code).toBe("unauthenticated");
});

test("acme admin can open acme and sees independent globex as inaccessible", async ({ page }) => {
  await loginToTenant(page, "acme-admin", "acme");
  await expect(page.getByTestId("user-name")).toContainText("Acme Admin");

  const denied = await page.goto("/t/globex/home");
  expect(denied?.status()).toBe(404);
});

test("globex employee cannot read acme APIs", async ({ page, request }) => {
  await loginWithOidc(page, "globex-employee", "/tenants");
  await expect(page.getByTestId("tenant-globex")).toBeVisible();
  await expect(page.getByTestId("tenant-acme")).toHaveCount(0);

  const context = await page.request.get("/api/v1/tenants/acme/context");
  expect(context.status()).toBe(404);
  const body = (await context.json()) as { error?: { message?: string }; data?: unknown };
  expect(body.data).toBeUndefined();
  expect(body.error?.message).not.toMatch(/acme/i);
});

test("platform admin has no tenant business access", async ({ page }) => {
  await loginWithOidc(page, "platform-admin", "/tenants");
  await expect(page.getByText("Ei jäsenyyksiä")).toBeVisible();

  const context = await page.request.get("/api/v1/tenants/acme/context");
  expect(context.status()).toBe(404);
});

test("revoked member loses tenant access", async ({ page }) => {
  await loginWithOidc(page, "acme-revoked", "/tenants");
  await expect(page.getByText("Ei jäsenyyksiä")).toBeVisible();
  const denied = await page.goto("/t/acme/home");
  expect(denied?.status()).toBe(404);
});

test("employee cannot invite members", async ({ page }) => {
  await loginToTenant(page, "acme-employee", "acme");
  const response = await page.request.post("/api/v1/tenants/acme/memberships", {
    data: { email: "new@acme.example", roleKey: "employee" },
    headers: { origin: "http://127.0.0.1:3000" },
  });
  expect(response.status()).toBe(403);

  const csrf = await page.request.post("/api/v1/tenants/acme/memberships", {
    data: { email: "new@acme.example", roleKey: "employee" },
    headers: { origin: "https://evil.example" },
  });
  expect(csrf.status()).toBe(403);
});

test("logout returns to the landing page", async ({ page }) => {
  await loginToTenant(page, "acme-admin", "acme");
  await page.getByTestId("logout").click();
  await expect(page.getByTestId("landing-login")).toBeVisible();
});
