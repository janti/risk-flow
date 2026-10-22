# Admin onboarding

Two pilot tenants in local and staging environments: **acme** and **globex**. Production users are not added with SQL.

## Platform bootstrap

1. Migrations as owner.
2. Local/staging seed (`pnpm db:seed`) creates tenants, org units, roles, and sample risks. In production the tenant is created by a platform DBA procedure; members are added in the UI.
3. Users are created in the IdP. RiskFlow provisions a `users` row on OIDC sign-in.

## Tenant admin (no direct database edits)

1. Sign in with the IdP.
2. Select the tenant at `/tenants`.
3. Settings → users: add a member with `mode: direct` or send an invite.
4. Check the organization tree, locale, and branding.
5. Confirm entitlements come from the platform. A tenant admin cannot grant themselves modules.

## Pilots acme and globex

| Tenant | Sample account (local IdP only) | Role |
|---|---|---|
| acme | `acme-admin` | tenant-admin |
| globex | `globex-admin` | tenant-admin |

Cross-access is denied: acme-admin sees globex as 404. A platform administrator has no tenant business data.

## Offboarding

1. `pnpm ops:tenant-export <slug>`
2. `TENANT_OFFBOARD_CONFIRM=<slug> pnpm ops:tenant-offboard <slug>`
3. The tenant is marked `offboarded`, memberships `revoked`. Hard delete of rows is a separate legal/DBA step.
