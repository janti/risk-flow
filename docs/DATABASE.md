# Database

Sprint 02 implements the Prisma schema, SQL migrations, and RLS for: `tenants`, `users`, `memberships`, `org_units`, `org_unit_memberships`, `roles`, `permissions`, `role_permissions`, `membership_roles`, `risk_categories`, `risks`, `audit_events`. Local PostgreSQL 16 starts without Docker.

## Shared rules

Every tenant-scoped table has `tenant_id UUID NOT NULL`, `created_at`, and `updated_at`. Critical mutable records also have `created_by` and `updated_by`. Intra-tenant references use compound keys that include `tenant_id`. Database constraints and RLS are mandatory. The global `users` table does not store tenant-sensitive material.

## Tables (plan)

`tenants`, `users`, `memberships`, `org_units`, `org_unit_memberships`, `roles`, `permissions`, `role_permissions`, `membership_roles`, `module_catalog`, `tenant_entitlements`, `tenant_modules`, `risk_categories`, `risks`, `risk_assessments`, `scoring_models`, `risk_treatments`, `actions`, `approvals`, `form_definitions`, `form_versions`, `workflow_definitions`, `workflow_versions`, `workflow_instances`, `dashboard_definitions`, `attachments`, `notifications`, `audit_events`, `outbox_events`.

Exact columns and constraints are in `docs/RISKFLOW_CURSOR_IMPLEMENTATION.md`.

## RLS and connection safety

- The runtime database role is not the owner and does not have `BYPASSRLS`.
- Tenant tables use `FORCE ROW LEVEL SECURITY`.
- Tenant identity: `SET LOCAL app.tenant_id = '<uuid>'` inside each transaction.
- Policy: `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid` for both `USING` and `WITH CHECK`.
- All reads and writes go through the tenant transaction wrapper.
- Migrations and the worker have separate privileges. The worker carries a verified tenant context.

## Local development

```bash
pnpm services:start
```

This starts native PostgreSQL 16 (`embedded-postgres`) and Redis. On Windows the Redis binary is downloaded from an open-source release; macOS/Linux use `redis-server` on PATH (`brew install redis` or `apt install redis-server`).

Connection strings are in `.env.example`:

- `DATABASE_URL` — migrations and seed (owner role)
- `DATABASE_URL_APP` — runtime `riskflow_app` (no BYPASSRLS)
- `DATABASE_URL_WORKER` — worker role (no BYPASSRLS)

```bash
pnpm db:migrate
pnpm db:seed
```

Credentials are local-development only. Data persists under `.local/` (gitignored). Routes use `createTenantDatabase(process.env.DATABASE_URL_APP).withTenant(...)` — not a raw Prisma client.

## Sprint 02 implementation

Implemented tables: `tenants`, `users`, `permissions` (global) and tenant-scoped `memberships`, `org_units`, `org_unit_memberships`, `roles`, `role_permissions`, `membership_roles`, `risk_categories`, `risks`, `audit_events`.

Intra-tenant references use compound keys `(tenant_id, id)`. Optional parents (`org_units.parent_id`, `risk_categories.parent_id`, `membership_roles.org_unit_id`) are `MATCH SIMPLE` so `NULL` is allowed without an id-only reference to another tenant.

RLS policy:

```sql
tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
```

for both `USING` and `WITH CHECK`. Tenant context is set in the transaction:

```sql
SELECT set_config('app.tenant_id', '<uuid>', true);
```

(`true` = `SET LOCAL`; the setting dies with the transaction and does not leak across the connection pool.)

The migration creates local login roles only if they are missing. In production, roles and passwords are provisioned before `pnpm db:migrate`. Cross-tenant tests: `packages/database/src/tenant-isolation.test.ts`.

Sprint 03 adds `users.platform_admin` (no tenant access) and `invitations` (FORCE RLS, pending-email unique, token hash). The app role may `INSERT/UPDATE` the global `users` table for JIT provisioning. `memberships` has a SELECT policy for `app.user_id` (`GET /me`). Invite redemption uses an `app.invite_token_hash` SELECT policy, then `withTenant`.

Sprint 04 uses the existing `risks` table. Writes happen in a `withTenant` transaction, increment `version`, and insert an `audit_events` row in the same transaction. Direct user add creates a user with `auth_subject` `pending-email|<email>` when needed; OIDC sign-in redeems it by swapping the subject.

Sprint 05 adds `scoring_models` and `risk_assessments` (FORCE RLS, composite FKs, append-only: no UPDATE/DELETE). A published model is immutable; a new threshold is a new `version`. An assessment stores `scoring_version_id` and the computed `score` and `rating`.

Sprint 06 adds `tenants.settings_json` (SoD and approval stages), `risk_treatments` (one per risk), `actions` (status + due date), `approvals` (append-only), and `outbox_events` (FORCE RLS). Approvals have no UPDATE/DELETE privilege.

Sprint 07 adds no tables. Dashboards read existing risks, assessments, treatments, and actions under RLS. A visual dashboard builder and `dashboard_definitions` stay out of MVP.

Sprint 08 adds `form_definitions` (unique tenant+key) and `form_versions` (unique tenant+definition+version, FORCE RLS). Published versions are immutable via trigger `reject_published_form_version_mutation` (drafts may be updated). `risks.form_version_id` is an optional composite FK (`MATCH SIMPLE`). The app role has SELECT/INSERT/UPDATE, not DELETE.

Sprint 09 adds a global `module_catalog` table (no RLS, app SELECT only) and tenant-scoped `tenant_entitlements` and `tenant_modules` (FORCE RLS). Entitlements are platform-controlled: the app role has SELECT only. `tenant_modules` allows SELECT/INSERT/UPDATE, not DELETE, so disablement keeps the row. `tenants` gets SELECT on all rows and UPDATE only in `app.tenant_id` context (locale, timezone, branding in `settings_json`).

Sprint 10 adds `attachments` and `notifications` (FORCE RLS, no DELETE). `attachments.object_key` is unique per tenant and tenant-prefixed. `notifications` unique `(tenant_id, membership_id, dedupe_key)` makes outbox retry idempotent. The worker gets an extra SELECT policy on `outbox_events` and `actions` when `app.worker_poll='true'` — cross-tenant poll without `BYPASSRLS`. Actual processing happens in a `withTenant` transaction using the outbox row `tenant_id`.

Sprint 11 adds list and search indexes: `risks (tenant_id, created_at, id)`, org-unit/owner/category, assessment type+time, and `pg_trgm` + `btree_gin` GIN indexes `(tenant_id, title)` / `(tenant_id, code)` for ILIKE search. RLS does not change.

Sprint 12 does not change the schema. Backup is an owner-role logical snapshot (`pnpm ops:backup`) and the restore drill restores a canary row from the dump (`pnpm ops:restore-drill`). Production should use native `pg_dump -Fc` when `PGBIN` is available. `audit_events` purge requires temporarily disabling the trigger as owner (`pnpm ops:audit-retention`). Tenant offboarding sets `tenants.status='offboarded'` and revokes memberships; rows are not deleted.
