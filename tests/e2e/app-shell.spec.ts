import { expect, test } from "@playwright/test";
import { loginToTenant } from "./helpers/oidc-login";

test("mobile sidebar can be opened and closed with the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginToTenant(page, "acme-admin", "acme");

  const openButton = page.getByTestId("open-sidebar");
  await expect(openButton).toBeVisible();
  await expect(openButton).toHaveAttribute("aria-expanded", "false");

  await openButton.focus();
  await page.keyboard.press("Enter");

  const sidebar = page.getByTestId("mobile-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(openButton).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar.getByRole("navigation", { name: "Päänavigaatio" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Riskit" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
  await expect(openButton).toBeFocused();
});

test("desktop shell shows persistent navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginToTenant(page, "acme-admin", "acme");

  await expect(page.getByTestId("open-sidebar")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Päänavigaatio" })).toBeVisible();
  await expect(page.getByTestId("tenant-slug")).toHaveText("acme");
});
