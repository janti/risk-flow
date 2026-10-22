import { expect, test } from "@playwright/test";
import { loginToTenant, loginWithOidc } from "./helpers/oidc-login";

const ORIGIN = "http://127.0.0.1:3000";

test("employee home shows assigned tasks and cannot read analytics", async ({ page }) => {
  test.setTimeout(60_000);
  await loginToTenant(page, "acme-employee", "acme");
  await expect(page.getByTestId("employee-home")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("employee-tasks")).toContainText("Review supplier questionnaire");
  await expect(page.getByRole("link", { name: "Analytiikka" })).toHaveCount(0);

  const overview = await page.request.get("/api/v1/tenants/acme/analytics/overview");
  expect(overview.status()).toBe(403);

  await page.goto("/t/acme/analytics");
  await expect(page.getByRole("heading", { name: "Ei oikeutta" })).toBeVisible();
});

test("manager dashboard totals match permitted records and drill down to filtered risks", async ({ page }) => {
  test.setTimeout(60_000);
  await loginToTenant(page, "acme-manager", "acme");
  await page.goto("/t/acme/home");
  await expect(page.getByTestId("role-dashboard")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("dashboard-audience")).toContainText("Esimiehen koonti");

  const overviewResponse = await page.request.get("/api/v1/tenants/acme/analytics/overview?assessmentType=residual");
  expect(overviewResponse.status()).toBe(200);
  const overviewBody = (await overviewResponse.json()) as {
    data: {
      overview: {
        window: { from: string; to: string };
        kpis: { openRisks: number; inProgressRisks: number };
        categories: { categoryId: string; code: string; count: number }[];
      };
    };
  };
  const listed = await page.request.get(
    `/api/v1/tenants/acme/risks?limit=100&createdFrom=${overviewBody.data.overview.window.from}&createdTo=${overviewBody.data.overview.window.to}`,
  );
  const listedBody = (await listed.json()) as { data: { risks: { code: string; orgUnit: { name: string } }[] } };
  expect(listedBody.data.risks.every((risk) => risk.orgUnit.name === "Operations")).toBe(true);
  expect(overviewBody.data.overview.kpis.openRisks + overviewBody.data.overview.kpis.inProgressRisks).toBe(
    listedBody.data.risks.length,
  );
  expect(listedBody.data.risks.some((risk) => risk.code === "OPS-001")).toBe(true);
  expect(listedBody.data.risks.some((risk) => risk.code === "R-001")).toBe(false);

  const ops = overviewBody.data.overview.categories.find((category) => category.code === "OPS");
  await page.getByTestId("category-OPS").click();
  await expect(page).toHaveURL(new RegExp(`categoryId=${ops?.categoryId}`));
  await expect(page.getByTestId("risk-row-OPS-001")).toBeVisible();
  await expect(page.getByTestId("risk-row-R-001")).toHaveCount(0);
});

test("risk manager analytics heatmap drilldown and csv stay tenant-scoped", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await loginToTenant(page, "acme-risk-manager", "acme");
  await page.goto("/t/acme/analytics");
  await expect(page.getByTestId("analytics-dashboard")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("dashboard-audience")).toContainText("Riskipäällikön analytiikka");
  await page.getByTestId("matrix-cell-5-4").click();
  await expect(page).toHaveURL(/likelihood=5/);
  await expect(page).toHaveURL(/impact=4/);
  await expect(page.getByTestId("risk-row-COMP-001")).toBeVisible();

  const csv = await page.request.get("/api/v1/tenants/acme/exports/risks.csv");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const csvText = await csv.text();
  expect(csvText).toContain("Single-source supplier outage");
  expect(csvText).toContain("OPS-001");

  const globexPage = await browser.newPage();
  await loginWithOidc(globexPage, "globex-admin", "/tenants");
  const denied = await globexPage.request.get("/api/v1/tenants/acme/analytics/overview");
  expect(denied.status()).toBe(404);
  const globexCsv = await globexPage.request.get("/api/v1/tenants/globex/exports/risks.csv");
  expect(globexCsv.status()).toBe(200);
  expect(await globexCsv.text()).not.toContain("Single-source supplier outage");
  await globexPage.close();
});
