import { expect, test } from "@playwright/test";
import { loginToTenant } from "./helpers/oidc-login";

const ORIGIN = "http://127.0.0.1:3000";

test("tenant admin publishes a field, risk manager fills it, employee can read it, globex cannot use it", async ({
  browser,
}) => {
  const adminPage = await browser.newPage();
  await loginToTenant(adminPage, "acme-admin", "acme");
  await adminPage.goto("/t/acme/settings/forms");
  await adminPage.getByTestId("form-create").click();
  const formKey = `risk_form_${Date.now()}`;
  await adminPage.getByTestId("form-key").fill(formKey);
  await adminPage.getByTestId("form-name").fill("Risk extra fields");
  await adminPage.getByTestId("form-create-submit").click();
  await expect(adminPage.getByTestId("field-palette")).toBeVisible();
  await adminPage.getByTestId("palette-shortText").click();
  await adminPage.getByTestId("field-key").fill("review_note");
  await adminPage.getByTestId("field-label").fill("Katselmusmuistio");
  await adminPage.getByTestId("form-save").click();
  await adminPage.getByTestId("form-publish-open").click();
  await expect(adminPage.getByTestId("form-impact")).toContainText("review_note");
  await adminPage.getByTestId("form-publish").click();
  await expect(adminPage.getByTestId("form-table")).toBeVisible();
  await expect(adminPage.getByTestId(`form-row-${formKey}`)).toBeVisible();

  const formList = await adminPage.request.get("/api/v1/tenants/acme/forms");
  expect(formList.status()).toBe(200);
  const formsBody = (await formList.json()) as { data: { forms: { id: string; key: string }[] } };
  const publishedForm = formsBody.data.forms.find((form) => form.key === formKey);
  expect(publishedForm).toBeDefined();

  const globexPage = await browser.newPage();
  await loginToTenant(globexPage, "globex-admin", "globex");
  const leaked = await globexPage.request.get(`/api/v1/tenants/globex/forms/${publishedForm!.id}`);
  expect(leaked.status()).toBe(404);
  const crossTenant = await globexPage.request.get(`/api/v1/tenants/acme/forms/${publishedForm!.id}`);
  expect(crossTenant.status()).toBe(404);
  await globexPage.close();

  const historical = await adminPage.request.get("/api/v1/tenants/acme/risks?q=R-001");
  expect(historical.status()).toBe(200);
  const historicalBody = (await historical.json()) as {
    data: { risks: { code: string; formVersion: { version: number } | null }[] };
  };
  expect(historicalBody.data.risks.find((risk) => risk.code === "R-001")?.formVersion).toBeNull();
  await adminPage.close();

  const managerPage = await browser.newPage();
  await loginToTenant(managerPage, "acme-risk-manager", "acme");
  await managerPage.goto("/t/acme/risks/new");
  await managerPage.getByTestId("risk-title").fill("Risk with published field");
  await expect(managerPage.getByTestId("custom-field-review_note")).toBeVisible();
  await managerPage.getByTestId("custom-field-review_note").fill("Manager filled note");
  await managerPage.getByTestId("risk-save").click();
  await expect(managerPage.getByTestId("risk-custom-fields")).toBeVisible();
  await expect(managerPage.getByTestId("custom-value-review_note")).toHaveText("Manager filled note");
  const riskCode = await managerPage.getByTestId("risk-code").innerText();
  await managerPage.close();

  const employeePage = await browser.newPage();
  await loginToTenant(employeePage, "acme-employee", "acme");
  await employeePage.goto("/t/acme/risks");
  await employeePage.getByTestId(`risk-row-${riskCode}`).click();
  await expect(employeePage.getByTestId("custom-value-review_note")).toHaveText("Manager filled note");
  const manage = await employeePage.request.post("/api/v1/tenants/acme/forms", {
    headers: { origin: ORIGIN },
    data: { key: "blocked", name: "Blocked", targetEntity: "risk" },
  });
  expect(manage.status()).toBe(403);
  await employeePage.close();
});
