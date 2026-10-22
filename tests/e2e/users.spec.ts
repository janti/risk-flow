import { expect, test } from "@playwright/test";
import { loginToTenant } from "./helpers/oidc-login";

test("tenant admin can add a user without sending an invite email", async ({ page }) => {
  await loginToTenant(page, "acme-admin", "acme");
  await page.goto("/t/acme/settings/users");
  const email = `no-invite-${Date.now()}@acme.example`;
  await page.getByTestId("member-add").click();
  await page.getByTestId("member-add-email").fill(email);
  await page.getByTestId("member-add-name").fill("No Invite");
  await page.getByTestId("member-add-submit").click();
  await expect(page.getByTestId("member-add-message")).toContainText("Käyttäjä lisätty");
  await expect(page.getByTestId(`member-status-${email}`)).toHaveText("Odottaa kirjautumista");
});

test("employee cannot add members directly", async ({ page }) => {
  await loginToTenant(page, "acme-employee", "acme");
  const response = await page.request.post("/api/v1/tenants/acme/memberships", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: { mode: "direct", email: "blocked@acme.example", roleKey: "employee" },
  });
  expect(response.status()).toBe(403);
});
