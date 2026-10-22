import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginToTenant, loginWithOidc } from "./helpers/oidc-login";

const ORIGIN = "http://127.0.0.1:3000";

async function createRiskViaApi(request: APIRequestContext, tenantSlug: string, title: string) {
  const lookups = await request.get(`/api/v1/tenants/${tenantSlug}/risks/lookups`);
  expect(lookups.status()).toBe(200);
  const lookupBody = (await lookups.json()) as {
    data: {
      categories: { id: string }[];
      orgUnits: { id: string; name: string }[];
      owners: { id: string }[];
    };
  };
  const orgUnit =
    lookupBody.data.orgUnits.find((unit) => unit.name === "Headquarters") ?? lookupBody.data.orgUnits[0];
  const created = await request.post(`/api/v1/tenants/${tenantSlug}/risks`, {
    headers: { origin: ORIGIN },
    data: {
      title,
      categoryId: lookupBody.data.categories[0]?.id,
      orgUnitId: orgUnit?.id,
      ownerId: lookupBody.data.owners[0]?.id,
    },
  });
  expect(created.status()).toBe(201);
  const body = (await created.json()) as { data: { risk: { id: string; code: string; version: number; title: string } } };
  return body.data.risk;
}

test("employee can read the register but cannot create risks", async ({ page }) => {
  await loginToTenant(page, "acme-employee", "acme");
  await page.goto("/t/acme/risks");
  await expect(page.getByTestId("risk-table")).toBeVisible();
  await page.getByTestId("risk-search").fill("R-001");
  await page.getByTestId("risk-filter-submit").click();
  await expect(page.getByTestId("risk-row-R-001")).toBeVisible();
  await expect(page.getByTestId("risk-create")).toHaveCount(0);

  const created = await page.request.post("/api/v1/tenants/acme/risks", {
    headers: { origin: ORIGIN },
    data: {
      title: "Employee should not create",
      categoryId: "00000000-0000-4000-8000-000000000000",
      orgUnitId: "00000000-0000-4000-8000-000000000000",
      ownerId: "00000000-0000-4000-8000-000000000000",
    },
  });
  expect(created.status()).toBe(403);
});

test("risk manager can create and edit a risk", async ({ page }) => {
  await loginToTenant(page, "acme-risk-manager", "acme");
  await page.goto("/t/acme/risks/new");
  await expect(page.getByTestId("standard-guidance")).toBeVisible();
  await expect(page.getByTestId("standard-guidance")).toContainText("ISO 31000");
  await page.getByTestId("risk-category").selectOption({ label: "Operations" });
  await expect(page.getByTestId("standard-guidance")).toContainText("ISO 45001");
  await page.getByTestId("guidance-use-template").click();
  await expect(page.getByTestId("risk-description")).toHaveValue(/Vaaran lähde/);
  await page.getByTestId("risk-title").fill("Playwright created risk");
  await page.getByTestId("risk-save").click();
  await expect(page.getByTestId("risk-detail")).toBeVisible();
  await expect(page.getByTestId("risk-code")).toHaveText(/R-\d+/);

  await page.getByTestId("risk-edit").click();
  await page.getByTestId("risk-title").fill("Playwright updated risk");
  await page.getByTestId("risk-save").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Playwright updated risk");
});

test("risk manager archive confirmation removes the risk from the default list", async ({ page }) => {
  await loginToTenant(page, "acme-risk-manager", "acme");
  await page.goto("/t/acme/risks/new");
  await page.getByTestId("risk-title").fill("Archive from UI");
  await page.getByTestId("risk-save").click();
  await expect(page.getByTestId("risk-detail")).toBeVisible();
  const code = await page.getByTestId("risk-code").innerText();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("risk-archive").click();
  await expect(page.getByTestId("risk-detail")).toContainText("Arkistoitu");

  await page.goto("/t/acme/risks");
  await expect(page.getByTestId("risk-table")).toBeVisible();
  await expect(page.getByTestId(`risk-row-${code}`)).toHaveCount(0);
});

test("tenant B cannot read tenant A's risk by id and stale edits return 409", async ({ page, browser }) => {
  await loginToTenant(page, "acme-risk-manager", "acme");
  const risk = await createRiskViaApi(page.request, "acme", "Cross-tenant isolation");

  const stale = await page.request.patch(`/api/v1/tenants/acme/risks/${risk.id}`, {
    headers: { origin: ORIGIN },
    data: { version: risk.version, title: "First writer" },
  });
  expect(stale.status()).toBe(200);

  const conflict = await page.request.patch(`/api/v1/tenants/acme/risks/${risk.id}`, {
    headers: { origin: ORIGIN },
    data: { version: risk.version, title: "Second writer" },
  });
  expect(conflict.status()).toBe(409);

  const globexPage = await browser.newPage();
  await loginWithOidc(globexPage, "globex-employee", "/tenants");
  const denied = await globexPage.request.get(`/api/v1/tenants/acme/risks/${risk.id}`);
  expect(denied.status()).toBe(404);
  const body = (await denied.json()) as { data?: unknown; error?: { message?: string } };
  expect(body.data).toBeUndefined();
  expect(body.error?.message).not.toMatch(/acme/i);
  await globexPage.close();
});
