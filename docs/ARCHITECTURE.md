# Architecture

RiskFlow is a **modular monolith**. One Next.js application serves the tenant UI and `/api/v1`. Domain logic lives in packages with no React dependency. Background jobs run in a separate worker process.

## Current state (Sprints 01–12)

Implemented:

- pnpm workspace and Turborepo
- `apps/web` with Next.js App Router, Tailwind, and a shadcn/ui-based design system
- responsive `AppShell` for tenant routes `/t/[tenantSlug]/...`
- `GET /health`
- local PostgreSQL 16 and Redis without Docker (`pnpm services:start`)
- worker (BullMQ): outbox drain, overdue reminders, and attachment scan state
- CI: typecheck, lint, unit tests, Playwright
- Prisma schema, SQL migrations, FORCE RLS, and tenant transaction wrapper (`set_config(..., true)`)
- Auth.js + OIDC, membership checks, role presets, invites, and direct user add
- risk-register CRUD, optimistic concurrency, audit events, and org-unit scoping
- versioned 3x3/5x5 scoring models, immutable inherent/residual assessments, authorised heatmap
- treatment strategies, actions, approval stages, separation of duties, transactional outbox
- role-based dashboards and authorised aggregates (`packages/analytics`): KPI, heatmap, categories, monthly trends, overdue actions, scoped CSV export
- dynamic forms (`packages/form-engine`): tenant definitions, immutable published versions, AST conditions, metadata-driven renderer
- module registry (`packages/module-registry`): catalogue, platform entitlements, tenant switches, dependencies, API-layer enablement
- organization tree, role permission matrix, and locale/branding (`packages/auth`)
- WCAG 2.2 AA hardening, global risk search, list indexes, and `Server-Timing` (Sprint 11). Measurements: `docs/PERFORMANCE.md`, accessibility: `docs/ACCESSIBILITY.md`.
- Category-based standard guidance (ISO 31000/27001/45001, NIST CSF 2.0, occupational safety) in the register, assessment, and treatment. Not a compliance-mapping module: `docs/STANDARDS.md`.
- Sprint 12: `GET /ready`, mutation rate limits, CSP/HSTS, backup/restore drill, tenant export/offboarding, incident and deploy runbooks. Monitoring without Sentry/OTel. Go/no-go: `docs/GO_NO_GO.md`.

Intentionally not implemented:

- real S3/MinIO, Sentry, OpenTelemetry

## Application boundaries

```
apps/web            HTTP, routes, UI
apps/worker         background jobs (BullMQ, outbox, reminders)
packages/ui         design system (React)
packages/shared     API envelopes, slug validation
packages/tenant     tenant contract
packages/permissions permission keys, default deny
packages/database   Prisma, RLS, tenant transaction
packages/auth       OIDC subjects, membership, RBAC helpers
packages/risk-engine scoring, assessments, risk-register service
packages/form-engine form definitions and AST
packages/module-registry module catalogue
packages/workflow-engine versioned workflows (later)
packages/analytics  authorised aggregates
modules/*           placeholders for optional features (catalogue Sprint 09)
```

`apps/web` owns routes. Domain packages do not import React. A raw Prisma client is not exposed to route handlers.

## Tenant context

Tenant is derived from verified membership and checked against the route `tenantSlug`. A tenant id in a JSON body is never trusted. `/t/[tenantSlug]` requires an active membership. Queries against tenant data go through the `withTenant` wrapper.

On database connections (Sprint 02) tenant is set **inside the transaction**:

```sql
SET LOCAL app.tenant_id = '<uuid>';
```

Session-level `SET` is forbidden on pooled connections.

## Data flow (target)

1. The browser calls `/api/v1/tenants/:slug/...` with a session cookie.
2. The server verifies session, membership, permission, and org-unit constraint.
3. The service layer opens a tenant transaction and uses Prisma under RLS.
4. Writes emit audit and outbox events in the same transaction.
5. The worker reads unprocessed outbox under `app.worker_poll`, then opens `withTenant` from the outbox row tenant (not from the user). The module is checked before side effects. Notification `dedupeKey` makes retries idempotent.

## UI routes

The UI lives under `/t/[tenantSlug]`: `home`, `risks`, `actions`, `analytics`, `incidents`, and `settings/*`. Auth routes: `/login`, `/tenants`, `/invite/[token]`.

## Release gates

- Prototype (Sprint 01): shell and navigation, no authentication promises
- Internal alpha (Sprints 1–5): tenant-safe risk CRUD and assessments
- Feature-complete beta (Sprints 1–10)
- Pilot-ready MVP (Sprints 1–12)
