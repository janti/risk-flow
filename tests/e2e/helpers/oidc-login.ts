import { expect, type Page } from "@playwright/test";

export async function loginWithOidc(
  page: Page,
  accountId: string,
  callbackPath = "/tenants",
): Promise<void> {
  await page.goto(`/login?callbackUrl=${callbackPath}`);
  await page.getByTestId("login-oidc").click();
  await expect(page.getByTestId("oidc-login")).toBeVisible();
  await page.getByTestId("oidc-login").selectOption(accountId);
  await page.getByTestId("oidc-password").fill("riskflow_dev_only");
  await page.getByTestId("oidc-submit").click();
  await page.waitForURL(
    (url) =>
      url.port !== "3300" &&
      !url.pathname.startsWith("/api/auth") &&
      url.pathname !== "/login",
  );
  const path = new URL(page.url()).pathname;
  if (path !== callbackPath && !path.startsWith("/t/")) {
    await page.goto(callbackPath);
  }
}

export async function loginToTenant(page: Page, accountId: string, tenantSlug: string): Promise<void> {
  await loginWithOidc(page, accountId, `/t/${tenantSlug}/home`);
  await expect(page.getByTestId("tenant-slug")).toHaveText(tenantSlug);
}
