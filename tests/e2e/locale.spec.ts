import { expect, test } from "@playwright/test";
import { loginToTenant } from "./helpers/oidc-login";

test("language switcher persists the user locale", async ({ page }) => {
  await loginToTenant(page, "acme-admin", "acme");
  await expect(page.getByRole("navigation", { name: "Päänavigaatio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Riskit" })).toBeVisible();

  await page.getByTestId("language-switcher").selectOption("en");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Risks" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await expect(page.getByRole("link", { name: "Risks" })).toBeVisible();

  const me = await page.request.get("/api/v1/me");
  expect(me.ok()).toBeTruthy();
  const body = (await me.json()) as { data: { user: { locale: string } } };
  expect(body.data.user.locale).toBe("en");

  await page.getByTestId("language-switcher").selectOption("sv");
  await expect(page.getByRole("link", { name: "Risker" })).toBeVisible();

  await page.getByTestId("language-switcher").selectOption("fi");
  await expect(page.getByRole("link", { name: "Riskit" })).toBeVisible();
});
