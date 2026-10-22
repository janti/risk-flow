import { expect, test } from "@playwright/test";
import { loginToTenant, loginWithOidc } from "./helpers/oidc-login";
import { openSeededRisk } from "./helpers/open-risk";

const ORIGIN = "http://127.0.0.1:3000";

test("employee can read actions but cannot assign or approve", async ({ page }) => {
  await loginToTenant(page, "acme-employee", "acme");
  await page.getByRole("link", { name: "Toimenpiteet" }).click();
  await expect(page.getByRole("heading", { name: "Toimenpiteet" })).toBeVisible();

  await page.getByRole("link", { name: "Riskit" }).click();
  await openSeededRisk(page);
  await expect(page.getByTestId("risk-detail")).toBeVisible();
  await expect(page.getByTestId("risk-treatment-panel")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("treatment-save")).toHaveCount(0);
  await expect(page.getByTestId("action-save")).toHaveCount(0);

  const listed = await page.request.get("/api/v1/tenants/acme/risks?q=R-001");
  const body = (await listed.json()) as { data: { risks: { id: string; code: string }[] } };
  const risk = body.data.risks.find((item) => item.code === "R-001");
  const assigned = await page.request.post(`/api/v1/tenants/acme/risks/${risk?.id}/actions`, {
    headers: { origin: ORIGIN },
    data: {
      title: "Employee should not assign",
      assigneeMembershipId: "00000000-0000-4000-8000-000000000000",
      dueAt: new Date().toISOString(),
    },
  });
  expect(assigned.status()).toBe(403);
});

test("identify assess treat approve complete flow respects separation of duties", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await loginToTenant(page, "acme-risk-manager", "acme");
  const lookups = await page.request.get("/api/v1/tenants/acme/risks/lookups");
  const lookupBody = (await lookups.json()) as {
    data: { categories: { id: string }[]; orgUnits: { id: string; name: string }[]; owners: { id: string }[] };
  };
  const orgUnit =
    lookupBody.data.orgUnits.find((unit) => unit.name === "Headquarters") ?? lookupBody.data.orgUnits[0];
  const created = await page.request.post("/api/v1/tenants/acme/risks", {
    headers: { origin: ORIGIN },
    data: {
      title: "Sprint 06 treatment flow",
      categoryId: lookupBody.data.categories[0]?.id,
      orgUnitId: orgUnit?.id,
      ownerId: lookupBody.data.owners[0]?.id,
    },
  });
  expect(created.status()).toBe(201);
  const createdBody = (await created.json()) as { data: { risk: { id: string } } };
  const riskId = createdBody.data.risk.id;
  await page.goto(`/t/acme/risks/${riskId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("risk-treatment-panel")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("treatment-strategy").selectOption("reduce");
  await page.getByTestId("treatment-target-date").fill("2026-12-31");
  await page.getByTestId("treatment-save").click();
  await expect(page.getByTestId("treatment-current")).toContainText("Odottaa");
  await expect(page.getByTestId("approval-sod")).toBeVisible();
  await expect(page.getByTestId("approval-approve")).toHaveCount(0);

  const selfApprove = await page.request.post(`/api/v1/tenants/acme/risks/${riskId}/approvals`, {
    headers: { origin: ORIGIN },
    data: { decision: "approve", comment: "Own submission" },
  });
  expect(selfApprove.status()).toBe(403);

  await page.getByTestId("action-title").fill("Review residual controls");
  await page.getByTestId("action-save").click();
  await expect(page.getByTestId("action-item").first()).toContainText("Review residual controls");

  const adminPage = await browser.newPage();
  await loginToTenant(adminPage, "acme-admin", "acme");
  await adminPage.goto(`/t/acme/risks/${riskId}`, { waitUntil: "domcontentloaded" });
  await expect(adminPage.getByTestId("approval-comment")).toBeVisible({ timeout: 15_000 });
  await adminPage.getByTestId("approval-comment").fill("Controls are sufficient.");
  await adminPage.getByTestId("approval-approve").click();
  await expect(adminPage.getByTestId("approval-item").first()).toContainText("Controls are sufficient.");
  await expect(adminPage.getByTestId("treatment-current")).toContainText("Hyväksytty");

  const completeButton = adminPage.getByRole("button", { name: "Merkitse valmiiksi" }).first();
  await completeButton.click();
  await expect(adminPage.getByTestId("action-item").first()).toContainText("Valmis");
  await adminPage.close();
});

test("overdue actions are visible and globex cannot mutate acme actions", async ({ page, browser }) => {
  await loginToTenant(page, "acme-risk-manager", "acme");
  await page.getByRole("link", { name: "Toimenpiteet" }).click();
  await expect(page.getByTestId("my-tasks-item").filter({ hasText: "Confirm alternate supplier" })).toBeVisible();
  await expect(page.getByTestId("my-tasks-item").filter({ hasText: "Myöhässä" })).toBeVisible();

  const listed = await page.request.get("/api/v1/tenants/acme/actions?overdue=true");
  const body = (await listed.json()) as { data: { actions: { id: string; title: string }[] } };
  const overdue = body.data.actions.find((item) => item.title === "Confirm alternate supplier");

  const globexPage = await browser.newPage();
  await loginWithOidc(globexPage, "globex-admin", "/tenants");
  const denied = await globexPage.request.patch(`/api/v1/tenants/acme/actions/${overdue?.id}`, {
    headers: { origin: ORIGIN },
    data: { status: "completed" },
  });
  expect(denied.status()).toBe(404);
  await globexPage.close();
});
