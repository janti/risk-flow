import { expect, test } from "@playwright/test";
import { loginToTenant } from "./helpers/oidc-login";

const ORIGIN = "http://127.0.0.1:3000";

test("tenant admin can enable entitled modules and cannot call disabled ones", async ({ browser }) => {
  const adminPage = await browser.newPage();
  await loginToTenant(adminPage, "acme-admin", "acme");

  const before = await adminPage.request.get("/api/v1/tenants/acme/incidents");
  if (before.status() === 403) {
    expect((await before.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "module_disabled" },
    });
  }

  await adminPage.goto("/t/acme/settings/modules");
  await expect(adminPage.getByTestId("module-list")).toBeVisible();
  await expect(adminPage.getByTestId("module-row-risk-register")).toContainText("Päällä");
  await expect(adminPage.getByTestId("module-row-continuity")).toContainText("Ei entitlementtia");
  await expect(adminPage.getByTestId("module-toggle-continuity")).toBeDisabled();

  const enable = await adminPage.request.patch("/api/v1/tenants/acme/modules", {
    headers: { origin: ORIGIN, "content-type": "application/json" },
    data: { modules: [{ key: "incidents", enabled: true }] },
  });
  expect(enable.status()).toBe(200);

  await adminPage.goto("/t/acme/settings/modules");
  await expect(adminPage.getByTestId("module-row-incidents")).toContainText("Päällä");

  const enabledIncidents = await adminPage.request.get("/api/v1/tenants/acme/incidents");
  expect(enabledIncidents.status()).toBe(200);

  const continuity = await adminPage.request.patch("/api/v1/tenants/acme/modules", {
    headers: { origin: ORIGIN, "content-type": "application/json" },
    data: { modules: [{ key: "continuity", enabled: true }] },
  });
  expect(continuity.status()).toBe(403);
  expect((await continuity.json()) as { error: { code: string } }).toMatchObject({
    error: { code: "not_entitled" },
  });

  await adminPage.goto("/t/acme/incidents");
  await expect(adminPage.getByTestId("incidents-page")).toBeVisible();
  await expect(adminPage.getByRole("link", { name: "Poikkeamat" })).toBeVisible();

  await adminPage.goto("/t/acme/settings/organization");
  await expect(adminPage.getByTestId("org-tree")).toBeVisible();
  const unitName = `Tiimi ${Date.now()}`;
  await adminPage.getByTestId("org-unit-name").fill(unitName);
  await adminPage.getByTestId("org-unit-create").click();
  await expect(adminPage.getByTestId("org-tree")).toContainText(unitName);

  await adminPage.goto("/t/acme/settings/roles");
  await expect(adminPage.getByTestId("role-matrix")).toBeVisible();
  await expect(adminPage.getByTestId("role-row-employee")).toBeVisible();
  await adminPage.close();

  const globexPage = await browser.newPage();
  await loginToTenant(globexPage, "globex-admin", "globex");
  const globexIncidents = await globexPage.request.get("/api/v1/tenants/globex/incidents");
  expect(globexIncidents.status()).toBe(403);
  expect((await globexIncidents.json()) as { error: { code: string } }).toMatchObject({
    error: { code: "module_disabled" },
  });
  const globexEnable = await globexPage.request.patch("/api/v1/tenants/globex/modules", {
    headers: { origin: ORIGIN, "content-type": "application/json" },
    data: { modules: [{ key: "incidents", enabled: true }] },
  });
  expect(globexEnable.status()).toBe(403);
  expect((await globexEnable.json()) as { error: { code: string } }).toMatchObject({
    error: { code: "not_entitled" },
  });
  await globexPage.close();
});
