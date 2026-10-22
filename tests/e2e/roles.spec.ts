import { expect, test } from "@playwright/test";
import { loginToTenant } from "./helpers/oidc-login";

const ROLE_LOGINS = [
  { accountId: "acme-admin", tenantSlug: "acme", name: "Acme Admin" },
  { accountId: "acme-manager", tenantSlug: "acme", name: "Acme Manager" },
  { accountId: "acme-risk-manager", tenantSlug: "acme", name: "Acme Risk Manager" },
  { accountId: "acme-employee", tenantSlug: "acme", name: "Acme Employee" },
  { accountId: "globex-admin", tenantSlug: "globex", name: "Globex Admin" },
  { accountId: "globex-manager", tenantSlug: "globex", name: "Globex Manager" },
  { accountId: "globex-risk-manager", tenantSlug: "globex", name: "Globex Risk Manager" },
  { accountId: "globex-employee", tenantSlug: "globex", name: "Globex Employee" },
] as const;

for (const login of ROLE_LOGINS) {
  test(`${login.accountId} can open ${login.tenantSlug}`, async ({ page }) => {
    await loginToTenant(page, login.accountId, login.tenantSlug);
    await expect(page.getByTestId("user-name")).toContainText(login.name);
  });
}
