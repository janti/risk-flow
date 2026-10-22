import { expect, type Page } from "@playwright/test";

export async function openSeededRisk(page: Page, code = "R-001"): Promise<void> {
  await expect(page.getByTestId("risk-table")).toBeVisible();
  await page.getByTestId("risk-search").fill(code);
  await page.getByTestId("risk-filter-submit").click();
  await expect(page.getByTestId(`risk-row-${code}`)).toBeVisible();
  await page.getByTestId(`risk-row-${code}`).click();
}
