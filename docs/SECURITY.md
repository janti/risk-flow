# Security

## In force from Sprint 01

- No fake authentication, mock sessions, or bypass tokens.
- Secrets are not committed. `.env.example` contains empty or local-dev-only values.
- `GET /health` does not leak environment variables.
- Domain packages do not depend on React.
- Baseline security headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.
- Sprint 12: `Content-Security-Policy`, production `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, and `Cross-Origin-Resource-Policy`.

## Identity and tenant

Identity does not imply tenant access. Tenant is derived from verified membership, the slug is checked against membership, and the active role is authorised. A tenant id in a JSON body is never trusted. UUIDs are opaque; the server determines actor and tenant.

## Authorization

Permission keys: `risk:read`, `risk:create`, `risk:update`, `risk:archive`, `risk:assess`, `risk:approve`, `action:assign`, `action:complete`, `analytics:read`, `form:manage`, `module:manage`, `users:manage`, `audit:read`.

Check order: membership, permission, org unit, ownership, record visibility. Default deny. Platform administrators do not get automatic read access to tenant business data.

Sprint 06: `risk:approve` does not allow approving one's own treatment when the tenant `settings_json.separationOfDuties` flag is on. Action visibility follows the risk's org-unit scope.

Sprint 07: dashboard aggregates and CSV export use the same membership, permission, and org-unit predicates as list queries. Chart totals are reconciled to authorised rows in tests. CSV cells are neutralized against formula injection.

Sprint 08: form management requires `form:manage`. Conditional rules are AST, not executable code. Published `form_versions` rows are immutable. Another tenant's form is neither visible nor usable.

Sprint 09: module enablement is checked in the service and API layers, not only in navigation. A tenant admin cannot grant themselves an entitlement. A disabled module returns `403 module_disabled` for a direct API call.

Sprint 11: accessibility and performance hardening does not change the authorization model. `Server-Timing` exposes duration only, not SQL. Search uses the same `risk:read` and org-unit predicates as the list.

Sprint 12: mutations and login are rate-limited (`429 rate_limited`). `GET /ready` checks PostgreSQL and Redis and does not leak environment variables. `audit_events` retention is an owner-role DBA script; app/worker cannot DELETE/UPDATE. Tenant offboarding marks the tenant `offboarded` and memberships `revoked`. Pentest checklist: `docs/PENTEST.md`. Certification is not claimed.

Sprint 10: attachment keys are server-generated and tenant-prefixed; a client-supplied key is not trusted. Download and upload URLs expire (HMAC, 60 s). The worker uses the `DATABASE_URL_WORKER` role, SET LOCAL tenant from the outbox row, and `moduleIsEnabled` before side effects. Outbox processing is idempotent (`dedupeKey` / `processedAt`).

## Database

See `docs/DATABASE.md`. RLS + Prisma pooling is a known project risk: tenant context only via `SET LOCAL` in a transaction, never session-level.

Sprint 02: tenant tables have `ENABLE` + `FORCE ROW LEVEL SECURITY`. Runtime roles `riskflow_app` and `riskflow_worker` are `NOSUPERUSER` and `NOBYPASSRLS`. Routes use `createTenantDatabase(...).withTenant(...)`. A raw Prisma client is not exported from the package. `audit_events` is append-only (no UPDATE/DELETE). In other environments, database roles are created with their own passwords before migration.

## API

Session cookie (Auth.js JWT, httpOnly) and CSRF (same-origin Origin check for mutations). Error responses do not reveal another tenant's records: non-member gets 404, member without permission 403, unauthenticated 401. Lists use keyset pagination. `PATCH` requires `version` and returns 409 on concurrent edit.

A platform administrator does not get automatic read access to tenant business data. A revoked membership (`status=revoked`) cuts access immediately because membership is read from the database on every request, not from the JWT.

## Tests

Negative tests: SELECT/UPDATE/DELETE/INSERT, joins, aggregates, attachment URLs, jobs, and cross-tenant references. IDOR, CSRF, stored XSS, file upload, CSV injection, rate limit, and wrong-tenant caches. Sprint 12: `tests/e2e/security.spec.ts`, `packages/shared/src/rate-limit.test.ts`, and the audit append-only RLS case.
