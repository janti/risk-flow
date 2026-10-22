# Decisions

## ADR 0001 — Modular monolith

One deployable web app and worker. Domain boundaries via packages, not microservices. Rationale: 12-sprint MVP, one database, RLS isolation.

## ADR 0002 — pnpm and Turborepo

Workspaces and cached `typecheck` / `lint` / `test` pipelines. Node 22+.

## ADR 0003 — No fake authentication

Fake login, mock sessions, or bypass tokens are not implemented. Auth.js + real OIDC (locally `oidc-provider`, elsewhere an external IdP). Identity ≠ tenant access. Implemented in Sprint 03.

## ADR 0004 — PostgreSQL RLS and SET LOCAL

Tenant isolation in the database, not only in the application. Context is per transaction on pooled connections (`SELECT set_config('app.tenant_id', uuid, true)` = SET LOCAL). Runtime roles `riskflow_app` and `riskflow_worker` without `BYPASSRLS`. Implemented in Sprint 02.

## ADR 0005 — Versionable models, no visual builders

Forms, scoring, and workflows are versioned. Visual workflow/dashboard builders are out of MVP.

## ADR 0006 — Shared design system in `@riskflow/ui`

shadcn/ui and Radix live in `packages/ui`. The web app does not copy primitives.

## ADR 0007 — English documentation and English code

README files and `docs/` are English. Identifiers, API, and schema are English. The product UI is localized (Finnish, Swedish, English) via message catalogs.

## ADR 0008 — No Docker in local development

Docker Desktop requires sign-in and is paid for some organizations. Local PostgreSQL runs via `embedded-postgres` (real PostgreSQL 16 binaries, MIT). Redis runs as a native process (`redis-server` or an open-source Windows binary). The database stays PostgreSQL 16+; the RLS plan does not change.

## ADR 0009 — Local OIDC without Docker

Sprint 03 uses Auth.js and a real OIDC Authorization Code + PKCE flow. The local IdP is `oidc-provider` (Node), not a mock session. In production `AUTH_ISSUER` points at the organization's IdP.

## ADR 0010 — Direct user add without email

A tenant admin (`users:manage`) can create a membership immediately (`POST .../memberships`, `mode: "direct"`). Invite links remain available. A pending user's `auth_subject` is `pending-email|<email>` until OIDC sign-in redeems it. Email is not sent in Sprint 04.

## ADR 0011 — Local object storage without Docker

Sprint 10 uses an S3-compatible key model (`tenants/{tenantId}/...`) and HMAC-signed URLs. The local adapter writes to `.local/object-storage` so MinIO/Docker is not required. `S3_*` environment variables are reserved for a later real S3 backend.

## ADR 0012 — Monitoring without Sentry/OTel in MVP

Sprint 12 monitoring is liveness (`/health`), readiness (`/ready`), process logs, and `Server-Timing`. Sentry and OpenTelemetry are deferred so MVP is not tied to a third-party APM contract. Alerts attach to the reverse proxy and `/ready` 503 responses.
