# RiskFlow

Multi-tenant enterprise risk management SaaS. Identity does not imply tenant access. The product name is **RiskFlow**; the repository and local folder are **`risk-flow`**.

This is a pnpm / Turborepo modular monolith. Sprints 01–12 deliver a pilot-ready MVP: authentication, tenant-isolated risk register, assessments, treatments, actions, dashboards, dynamic forms, modules, attachments, notifications, exports, audit, accessibility, and operational runbooks.

RiskFlow does **not** claim ISO 27001, ISO 45001, ISO 31000, or any other compliance certification.

## Contents

- [What it is](#what-it-is)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Local accounts](#local-accounts)
- [Scripts](#scripts)
- [Checks and tests](#checks-and-tests)
- [What goes to GitHub](#what-goes-to-github)
- [Operations](#operations)
- [Documentation](#documentation)
- [Out of MVP scope](#out-of-mvp-scope)

## What it is

RiskFlow is a tenant-isolated application for recording, assessing, treating, and reporting operational, occupational-safety, information-security, and similar risks.

| Area | What you get |
|---|---|
| Tenancy | Slug-based tenants (`/t/acme`, `/t/globex`). Membership is checked on every request. |
| Register | CRUD, optimistic concurrency, org-unit scoping, archive, custom form fields |
| Assessment | Versioned 3×3 / 5×5 scoring, inherent and residual scores, authorised heatmap |
| Treatment | Strategies `avoid \| reduce \| share \| accept`, actions, approvals, separation of duties |
| Analytics | Role-scoped KPIs, heatmap, categories, trends, overdue actions, CSV / PDF export |
| Forms | Tenant form definitions, immutable published versions, AST conditions (not eval) |
| Modules | Platform entitlements; tenant admins cannot grant themselves modules |
| Files | Private object storage, server-generated tenant-prefixed keys, expiring signed URLs |
| Guidance | Category packs (OHS, cyber, compliance, finance) mapped to ISO 31000 / 45001 / 27001, NIST CSF 2.0, Finnish OSH sources — guidance, not a control library |

UI languages: Finnish, Swedish, English. Source identifiers, API paths, and schema fields are English. Architecture and ops documents under `docs/` are Finnish.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22+, pnpm 12, Turborepo |
| Web | Next.js App Router, React 19, Tailwind, shadcn / Radix (`packages/ui`) |
| Auth | Auth.js (next-auth) + OIDC Authorization Code + PKCE |
| Data | PostgreSQL 16, Prisma, FORCE RLS, `SET LOCAL app.tenant_id` |
| Jobs | `apps/worker`, BullMQ, Redis, transactional outbox |
| Tests | Vitest, Playwright |
| Local services | embedded-postgres + native Redis + `oidc-provider` — **no Docker** |

Package scope is `@riskflow/*`. Domain packages (`tenant`, `permissions`, `risk-engine`, `form-engine`, `module-registry`, `database`, `auth`, `workflow-engine`, `analytics`) must not depend on React.

## Architecture

```
apps/web            HTTP, App Router UI, /api/v1
apps/worker         BullMQ: outbox drain, overdue reminders, attachment scan state
packages/ui         design system (React)
packages/shared     envelopes, i18n, rate limit, security headers
packages/database   Prisma, RLS, createTenantDatabase().withTenant(...)
packages/auth       OIDC subjects, membership, RBAC helpers
packages/risk-engine scoring, register, treatments, guidance
packages/form-engine definitions and AST
packages/module-registry catalogue, entitlements, enablement
packages/analytics  authorised aggregates
modules/*           placeholders for later feature packs
```

`apps/web` owns routes. Route handlers never receive an unrestricted `PrismaClient`. Tenant database work uses `createTenantDatabase` and:

```sql
SELECT set_config('app.tenant_id', '<uuid>', true);  -- SET LOCAL, dies with the transaction
```

Session-level `SET` on pooled connections is forbidden. Runtime roles `riskflow_app` and `riskflow_worker` are `NOSUPERUSER` and `NOBYPASSRLS`. Migrations use the owner URL (`DATABASE_URL`).

Request path:

1. Browser calls `/api/v1/tenants/:slug/...` with an httpOnly session cookie.
2. Server checks session, membership, permission, and org-unit scope.
3. Service opens a tenant transaction and uses Prisma under RLS.
4. Writes emit `audit_events` and `outbox_events` in the same transaction.
5. Worker polls unprocessed outbox as `app.worker_poll`, then `withTenant` using the **outbox row tenant**, not the user. `moduleIsEnabled` is checked before side effects. `dedupeKey` keeps retries idempotent.

UI lives under `/t/[tenantSlug]` (`home`, `risks`, `actions`, `analytics`, `incidents`, `settings/*`). Auth routes: `/login`, `/tenants`, `/invite/[token]`.

## Security model

- No fake login, mock sessions, or bypass tokens.
- Identity ≠ tenant access. Tenant comes from verified membership and the route slug, never from a JSON body.
- Default deny. Platform administrators do not get automatic access to tenant business data.
- CSRF: same-origin `Origin` check on mutations.
- Errors: unauthenticated `401`, member without permission `403`, non-member `404` (no existence leak).
- Mutations: optimistic `version`, `409` on conflict, in-process rate limit `429 rate_limited` + `Retry-After`.
- Headers: CSP (IdP origin allowed in `form-action` / `connect-src`), clickjacking deny, HSTS in production, COOP / CORP.
- Attachments: server-generated keys `tenants/{tenantId}/...`. Client-supplied keys are rejected. Signed URLs expire.
- `audit_events` is append-only for app/worker (trigger + `REVOKE UPDATE, DELETE`). Retention purge is an owner-role DBA procedure.
- `GET /health` is liveness. `GET /ready` pings PostgreSQL and Redis and does not leak environment values.
- Monitoring in MVP: health, ready, process logs, `Server-Timing`. No Sentry or OpenTelemetry.

Pentest checklist and residual risks: `docs/PENTEST.md`. Go / no-go: `docs/GO_NO_GO.md` (conditional GO for a closed pilot; not GO for an open internet deploy without an independent pentest).

## Repository layout

```
risk-flow/
  apps/web/              Next.js
  apps/worker/           background jobs
  packages/              domain and UI packages
  modules/               future module packs
  scripts/               local services and owner-role ops CLI
  tests/e2e/             Playwright
  tests/security/        security test notes
  docs/                  Finnish product and ops docs
  .github/workflows/     CI
  .cursor/rules/         Cursor project rules
  .env.example           local-dev placeholders only
```

## Prerequisites

- Node.js 22 or newer (see `.nvmrc`)
- pnpm 12.4.2 (`packageManager` in `package.json`)

Docker is not used. PostgreSQL 16, Redis, and a local OIDC issuer start from `pnpm services:start`.

## Local setup

```bash
git clone <github-url> risk-flow
cd risk-flow
cp .env.example .env
pnpm install
pnpm services:start          # keep this terminal open
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm services:start` launches PostgreSQL 16, Redis, and OIDC at `http://127.0.0.1:3300`. Stop with `pnpm services:stop`. Status: `pnpm services:status`. Data lives under `.local/` (gitignored). If the cluster already exists, start skips `initdb`.

`pnpm db:migrate` and `pnpm db:seed` use the owner role. The app runtime uses `DATABASE_URL_APP` (`riskflow_app`). The worker uses `DATABASE_URL_WORKER`.

| URL | Purpose |
|---|---|
| [http://127.0.0.1:3000](http://127.0.0.1:3000) | Web UI |
| [http://127.0.0.1:3000/health](http://127.0.0.1:3000/health) | Liveness |
| [http://127.0.0.1:3000/ready](http://127.0.0.1:3000/ready) | Postgres + Redis |
| [http://127.0.0.1:3000/login](http://127.0.0.1:3000/login) | Sign-in |

`pnpm dev` starts Next.js and the worker. Tenant admins can add users without email (`mode: "direct"`) or via invite link.

Do not run the local seed against production. Production rejects secrets containing `dev_only` when `APP_ENV=production`.

## Local accounts

Password for every seeded OIDC user: `riskflow_dev_only`.

| Account | Tenant | Role |
|---|---|---|
| `acme-admin` / `globex-admin` | acme / globex | tenant-admin |
| `acme-manager` / `globex-manager` | acme / globex | manager (Operations org unit) |
| `acme-risk-manager` / `globex-risk-manager` | acme / globex | risk-manager |
| `acme-employee` / `globex-employee` | acme / globex | employee |
| `platform-admin` | — | platform admin, **no** tenant business access |
| `acme-revoked` | acme | revoked membership |

Cross-tenant access is denied (`404`). These two tenants are the local pilots; day-two users are added in the UI, not with SQL.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Web + worker |
| `pnpm build` | Production build |
| `pnpm services:start \| stop \| status` | Postgres, Redis, OIDC |
| `pnpm db:migrate` | Owner-role SQL migrations |
| `pnpm db:seed` | Local acme / globex seed |
| `pnpm db:generate` | Prisma client |
| `pnpm typecheck` / `lint` / `test` / `test:e2e` | Quality gates |
| `pnpm ops:backup` | Logical JSON snapshot (owner role) |
| `pnpm ops:restore-drill` | Restore a canary row from that snapshot |
| `pnpm ops:tenant-export <slug>` | Tenant export JSON |
| `TENANT_OFFBOARD_CONFIRM=<slug> pnpm ops:tenant-offboard <slug>` | Mark tenant `offboarded`, revoke memberships |
| `pnpm ops:audit-retention` | Dry-run unless `AUDIT_PURGE_CONFIRM=PURGE` |

Embedded Postgres on Windows does not ship `pg_dump`. Local backup is a logical snapshot. Production should use native `pg_dump -Fc` with `PGBIN` set. See `docs/DEPLOY.md`.

## Checks and tests

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium   # first e2e run
pnpm test:e2e
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, and Playwright.

RLS negatives live in `packages/database/src/tenant-isolation.test.ts`. Auth / IDOR / CSRF e2e: `tests/e2e/auth.spec.ts`. Headers, `/ready`, two-tenant isolation: `tests/e2e/security.spec.ts`.

## What goes to GitHub

This tree does not yet have git history. First publish: `git init`, add a remote, ordinary `git push` (never `--force` to `main` / `master`).

**Commit:**

- `apps/`, `packages/` (except generated Prisma client), `modules/`, `scripts/`, `tests/`, `docs/`
- Root config: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, ESLint / Prettier, `.npmrc`, `.nvmrc`
- `.github/workflows/ci.yml`
- `.env.example` (local `*_dev_only` placeholders only)
- `.gitignore`
- `.cursor/rules/`
- this README

**Do not commit:**

| Path | Why |
|---|---|
| `.env`, `.env.local`, `.env.*.local` | real secrets |
| `.local/` | Postgres data, Redis, OIDC pid, object storage, backups, tenant exports |
| `node_modules/` | restored by `pnpm install` |
| `packages/database/src/generated/` | Prisma client from `pnpm db:generate` / postinstall |
| `apps/web/.next/`, `dist/`, `.turbo/`, `coverage/` | build cache |
| `playwright-report/`, `test-results/` | local reports |
| `*.log`, `.idea`, `.vscode` except `extensions.json` | machine-specific |

Production `AUTH_SECRET`, database passwords, and S3 keys belong in the platform secret store, not GitHub. Seed fixtures for acme / globex may live in code; they must not be applied in production.

Before a push: `git status` — `.env` and `.local` must not be staged.

## Operations

Staging and production are separated with `APP_ENV`. Production requires HTTPS `AUTH_URL` and rejects `dev_only` secrets.

- Deploy checklist: `docs/DEPLOY.md`
- Admin onboarding (UI membership, no SQL for users): `docs/ONBOARDING.md`
- Incident runbook: `docs/INCIDENT.md`
- Release notes: `docs/RELEASE_NOTES.md`

Alerts should hook reverse-proxy 5xx and `GET /ready` returning `503`. Rollback is previous artefact plus dump restore.

## Documentation

Finnish docs under `docs/`:

| Doc | Topic |
|---|---|
| [PRD](docs/PRD.md) | Product |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Modular monolith |
| [DATABASE](docs/DATABASE.md) | Schema, RLS, roles |
| [SECURITY](docs/SECURITY.md) | AuthZ, headers, tests |
| [API](docs/API.md) | `/api/v1` contract |
| [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) | UI primitives |
| [DECISIONS](docs/DECISIONS.md) | ADRs |
| [ROADMAP](docs/ROADMAP.md) | Sprints 01–12 |
| [ACCESSIBILITY](docs/ACCESSIBILITY.md) | WCAG 2.2 AA |
| [PERFORMANCE](docs/PERFORMANCE.md) | Indexes, Server-Timing |
| [STANDARDS](docs/STANDARDS.md) | Guidance frameworks |
| [DEPLOY](docs/DEPLOY.md) | Staging / production |
| [ONBOARDING](docs/ONBOARDING.md) | Pilot tenants |
| [INCIDENT](docs/INCIDENT.md) | Incident response |
| [RELEASE_NOTES](docs/RELEASE_NOTES.md) | Sprint 12 notes |
| [PENTEST](docs/PENTEST.md) | Checklist, residuals |
| [GO_NO_GO](docs/GO_NO_GO.md) | Pilot decision |

Implementation prompts: `docs/RISKFLOW_CURSOR_IMPLEMENTATION.md`.

## Out of MVP scope

- Visual workflow canvas and visual dashboard builder (models remain versionable)
- Real S3 / MinIO in local dev (local disk adapter is allowed; `S3_*` is reserved)
- Sentry / OpenTelemetry
- Docker for local development
- New product modules beyond the Sprint 09 catalogue
- Independent penetration test and compliance certification
