import { expect, test } from "@playwright/test";
import { loginToTenant } from "./helpers/oidc-login";

test("skip link moves focus to main content", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginToTenant(page, "acme-admin", "acme");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Siirry sisältöön" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("employee can open own tasks on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginToTenant(page, "acme-employee", "acme");
  await page.getByTestId("open-sidebar").click();
  await page.getByRole("link", { name: "Toimenpiteet" }).click();
  await expect(page.getByRole("heading", { name: "Toimenpiteet" })).toBeVisible();
  await expect(page.getByTestId("open-sidebar")).toBeVisible();
});

test("risk register uses cards on mobile and a captioned table on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginToTenant(page, "acme-admin", "acme");
  await page.goto("/t/acme/risks");
  await expect(page.getByTestId("risk-card-list")).toBeVisible();
  await expect(page.getByTestId("risk-table")).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId("risk-table")).toBeVisible();
  await expect(page.getByTestId("risk-table").locator("caption")).toHaveText("Valtuutetut riskit");
});

test("manager dashboard KPIs are usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginToTenant(page, "acme-manager", "acme");
  await expect(page.getByTestId("kpi-row")).toBeVisible();
  await expect(page.getByTestId("kpi-open-risks")).toBeVisible();
  await page.getByTestId("open-sidebar").click();
  await page.getByRole("link", { name: "Riskit" }).click();
  await expect(page.getByTestId("risk-card-list")).toBeVisible();
});

test("slash focuses the global risk search", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginToTenant(page, "acme-admin", "acme");
  await page.keyboard.press("/");
  await expect(page.getByTestId("command-search")).toBeFocused();
  await page.getByTestId("command-search").fill("R-001");
  await expect(page.getByTestId("command-search-results")).toBeVisible();
  await expect(page.getByTestId("command-search-results")).toContainText("R-001");
});
