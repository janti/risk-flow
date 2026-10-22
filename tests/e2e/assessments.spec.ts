import { expect, test } from "@playwright/test";
import { loginToTenant, loginWithOidc } from "./helpers/oidc-login";
import { openSeededRisk } from "./helpers/open-risk";

const ORIGIN = "http://127.0.0.1:3000";

test("employee can read assessments but cannot create them", async ({ page }) => {
  await loginToTenant(page, "acme-employee", "acme");
  await page.goto("/t/acme/risks");
  await expect(page.getByTestId("risk-matrix")).toBeVisible();
  await openSeededRisk(page);
  await expect(page.getByTestId("risk-assessment-panel")).toBeVisible();
  await expect(page.getByTestId("assessment-save")).toHaveCount(0);

  const listed = await page.request.get("/api/v1/tenants/acme/risks?q=R-001");
  const body = (await listed.json()) as { data: { risks: { id: string; code: string }[] } };
  const risk = body.data.risks.find((item) => item.code === "R-001");
  const created = await page.request.post(`/api/v1/tenants/acme/risks/${risk?.id}/assessments`, {
    headers: { origin: ORIGIN },
    data: {
      assessmentType: "residual",
      likelihood: 2,
      impact: 2,
      rationale: "Employee should not assess",
      scoringVersionId: "00000000-0000-4000-8000-000000000000",
    },
  });
  expect(created.status()).toBe(403);
});

test("risk manager can record a residual assessment and filter the matrix", async ({ page }) => {
  await loginToTenant(page, "acme-risk-manager", "acme");
  await page.goto("/t/acme/risks");
  await openSeededRisk(page);
  await page.getByTestId("assessment-type").selectOption("residual");
  await page.getByTestId("assessment-likelihood").selectOption("2");
  await page.getByTestId("assessment-impact").selectOption("3");
  await page.getByTestId("assessment-rationale").fill("Controls reduce likelihood.");
  await page.getByTestId("assessment-save").click();
  await expect(page.getByTestId("assessment-item").first()).toContainText("2 × 3 = 6");

  await page.goto("/t/acme/risks");
  await page.getByTestId("matrix-type").selectOption("residual");
  await page.getByTestId("matrix-cell-2-3").click();
  await expect(page.getByTestId("risk-row-R-001")).toBeVisible();
});

test("globex cannot read acme assessments and heatmap requires analytics:read", async ({ page, browser }) => {
  await loginToTenant(page, "acme-risk-manager", "acme");
  const listed = await page.request.get("/api/v1/tenants/acme/risks?q=R-001");
  const body = (await listed.json()) as { data: { risks: { id: string; code: string }[] } };
  const risk = body.data.risks.find((item) => item.code === "R-001");

  const globexPage = await browser.newPage();
  await loginWithOidc(globexPage, "globex-employee", "/tenants");
  const denied = await globexPage.request.get(`/api/v1/tenants/acme/risks/${risk?.id}/assessments`);
  expect(denied.status()).toBe(404);
  const heatmap = await globexPage.request.get("/api/v1/tenants/globex/analytics/heatmap");
  expect(heatmap.status()).toBe(403);
  await globexPage.close();
});
