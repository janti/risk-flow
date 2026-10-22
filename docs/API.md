# API

Base: `/api/v1`. Success envelope `{ data, meta }`, errors `{ error: { code, message, details?, requestId } }`.

Public health route:

`GET /health` → `{ "data": { "status": "ok", "timestamp": "..." }, "meta": {} }` (liveness, no dependency checks)

`GET /ready` → `{ "data": { "status": "ok", "timestamp": "...", "postgres": true, "redis": true }, "meta": {} }`. If PostgreSQL or Redis does not respond: `503 service_unavailable` without environment variables.

Sprint 03 implements identity and membership routes. Sprint 04 adds the risk register. Sprint 05 adds assessments and the heatmap. Sprint 06 adds actions, treatments, and approvals. Sprint 07 adds dashboard aggregates and scoped CSV export. Sprint 08 adds dynamic forms. Sprint 09 adds modules, organization, and tenant settings. Sprint 10 adds attachments, notifications, PDF summary, and the audit list. The contract is frozen:

| Method | Endpoint | Permission |
|---|---|---|
| GET | /me | authenticated |
| GET | /tenants/:slug/context | member |
| GET/POST | /tenants/:slug/risks | risk:read/create |
| GET/PATCH | /tenants/:slug/risks/:id | risk:read/update |
| POST | /tenants/:slug/risks/:id/archive | risk:archive |
| GET/POST | /tenants/:slug/risks/:id/assessments | risk:read/assess |
| GET/POST | /tenants/:slug/risks/:id/actions | risk:read/action:assign |
| PATCH | /tenants/:slug/actions/:id | action:complete or action:assign |
| POST | /tenants/:slug/risks/:id/approvals | risk:approve |
| GET | /tenants/:slug/analytics/overview | analytics:read |
| GET | /tenants/:slug/analytics/heatmap | analytics:read |
| GET/POST | /tenants/:slug/forms | form:manage |
| GET/POST | /tenants/:slug/forms/:id/versions | form:manage |
| POST | /tenants/:slug/forms/:id/versions/:version/publish | form:manage |
| GET/PATCH | /tenants/:slug/modules | module:manage |
| GET/POST | /tenants/:slug/memberships | users:manage |
| GET | /tenants/:slug/audit-events | audit:read |
| POST | /tenants/:slug/attachments/upload-intent | risk:update |
| GET | /tenants/:slug/risks/:id/attachments | risk:read |
| GET | /tenants/:slug/attachments/:id | risk:read |
| GET/PUT | /tenants/:slug/attachments/:id/content | risk:read / risk:update + signed query |
| GET | /tenants/:slug/notifications | member |
| PATCH | /tenants/:slug/notifications/:id | member |
| GET | /tenants/:slug/exports/risks.csv | risk:read |
| GET | /tenants/:slug/exports/risks.pdf | risk:read |

List query: `cursor`, `limit` (default 25, max 100), `status`, `categoryId`, `orgUnitId`, `ownerId`, `q`, `sort`. Keyset pagination. Tenant slug comes from the route, not the body.

HTTP codes: 201 on create, 400/422 on invalid input, 401, 403, 404, 409 on concurrency, 429 rate limit.

## Sprint 04

Implemented risk routes:

- `GET /tenants/:slug/risks` — `risk:read`, filters and keyset pagination (`meta.nextCursor`)
- `POST /tenants/:slug/risks` — `risk:create`, code `R-nnn`, 201
- `GET /tenants/:slug/risks/lookups` — categories, units, and owners for forms
- `GET /tenants/:slug/risks/:id` — `risk:read`
- `PATCH /tenants/:slug/risks/:id` — `risk:update`, requires `version`, stale version → 409
- `POST /tenants/:slug/risks/:id/archive` — `risk:archive`, requires `version`

An org-unit-scoped member cannot see or change risks outside the scope (404). Another tenant's id does not leak (404).

`POST /tenants/:slug/memberships` accepts `mode: "invite"` (default) or `mode: "direct"`. Direct add creates a membership without an invite token or email. If the user does not exist, a pending identity is created and redeemed on the first OIDC sign-in with the same email.

## Sprint 05

- `GET/POST /tenants/:slug/risks/:id/assessments` — `risk:read` / `risk:assess`. Assessments are append-only. The server computes `score = likelihood * impact` and `rating` from the selected model version thresholds.
- `GET /tenants/:slug/risks/matrix` — `risk:read`, heatmap for cell filtering
- `GET /tenants/:slug/analytics/heatmap` — `analytics:read`, same authorised calculations
- The risk list accepts `assessmentType`, `likelihood`, and `impact` (latest assessment per type)

Historical assessments keep model version, score, and rating even if the tenant publishes a new scoring model.

## Sprint 06

- `GET/POST /tenants/:slug/risks/:id/treatments` — `risk:read` / `risk:update`. One treatment per risk. Strategies `avoid|reduce|share|accept`. Approval requires a rationale.
- `POST /tenants/:slug/risks/:id/approvals` — `risk:approve`. Append-only decision. Tenant `settings_json.separationOfDuties` blocks approving one's own submission.
- `GET/POST /tenants/:slug/risks/:id/actions` — `risk:read` / `action:assign`
- `GET /tenants/:slug/actions` — `risk:read`, filters `mine`, `overdue`, `status`
- `PATCH /tenants/:slug/actions/:id` — `action:assign` for update, `action:complete` for completion

Writes emit `audit_events` and `outbox_events` in the same transaction. The worker does not process the outbox in this sprint.

## Sprint 07

- `GET /tenants/:slug/analytics/overview` — `analytics:read`. Authorised KPIs, heatmap, categories, monthly trends, and overdue actions. Query `from`, `to` (ISO date, default 12 months) and `assessmentType`.
- `GET /tenants/:slug/analytics/heatmap` — `analytics:read`, current authorised matrix without time filter (Sprint 05).
- `GET /tenants/:slug/exports/risks.csv` — `risk:read`, same org-unit and filter logic as the risk list. Formulas (`=`, `+`, `-`, `@`) are neutralized.
- The risk list accepts `createdFrom` and `createdTo` for dashboard drill-down.

Aggregates use the same `visibleOrgUnitFilter` predicate as list queries. A visual dashboard builder is not in MVP.

## Sprint 08

- `GET/POST /tenants/:slug/forms` — `form:manage`. Definitions, unique `key` per tenant.
- `GET /tenants/:slug/forms/:id` — `form:manage`. One definition with versions.
- `GET/POST /tenants/:slug/forms/:id/versions` — `form:manage`. List and get-or-create draft. One draft at a time; if a draft exists, POST returns it.
- `GET/PATCH /tenants/:slug/forms/:id/versions/:version` — `form:manage`. Draft save and migration-impact preview. A published version cannot be PATCHed (409).
- `POST /tenants/:slug/forms/:id/versions/:version/publish` — `form:manage`. Validation and publish. The published row is immutable.

Conditional rules are AST expressions (`equals`, `in`, `greaterThan`, `and`, `or`, `not`). Executable scripts are rejected. The published schema is returned to fillers in `GET /tenants/:slug/risks/lookups` as `publishedForm` (`risk:read`) so a risk manager can fill fields without `form:manage`. A new risk is bound to the currently published version (`form_version_id`). Update does not change the version; historical records render with the original schema.

Another tenant's form id does not leak (404). An employee does not have `form:manage` (403).

## Sprint 09

- `GET/PATCH /tenants/:slug/modules` — `module:manage`. Catalogue, entitlements, and switches. Enable requires entitlement and dependencies. Disable is blocked if a dependent module is on. Disablement does not delete records.
- `GET /tenants/:slug/incidents` — `risk:read` and enabled `incidents` module. Stub list. When disabled: `403 module_disabled`.
- `GET/POST/PATCH /tenants/:slug/org-units` — `users:manage`. Organization tree. Cycle → 409.
- `GET/PATCH /tenants/:slug/roles` — `users:manage`. Role permission matrix. `users:manage` / `module:manage` cannot be removed from tenant-admin.
- `GET/PATCH /tenants/:slug/settings` — `users:manage`. Locale, timezone, and branding. SoD settings are not overwritten.
- `GET /tenants/:slug/context` returns only **enabled** module keys.

A disabled `risk-register` returns `403 module_disabled` on risk, form, and analytics routes, not only in navigation. Entitlements cannot be written by a tenant admin.

## Sprint 10

- `POST /tenants/:slug/attachments/upload-intent` — `risk:update`. The server creates a tenant-prefixed key and a 60 s PUT URL. MIME allowlist and max 10 MB. `.exe` is rejected.
- `PUT /tenants/:slug/attachments/:id/content?exp=&sig=` — session + HMAC. Wrong tenant key or expired signature → 403/404. Storage writes an `attachment.uploaded` outbox row.
- `GET /tenants/:slug/attachments/:id` — signed download URL. `pending_scan` → 409, `infected` → 403.
- `GET /tenants/:slug/attachments/:id/content?exp=&sig=` — file content.
- `GET /tenants/:slug/risks/:id/attachments` — `risk:read`, org-unit scope.
- `GET /tenants/:slug/notifications` — member inbox, `unreadCount`, keyset pagination.
- `PATCH /tenants/:slug/notifications/:id` — mark read. Another member's row → 404.
- `GET /tenants/:slug/audit-events` — `audit:read`, immutable list, `meta.nextCursor`.
- `GET /tenants/:slug/exports/risks.pdf` — same scope as CSV.

The worker (`DATABASE_URL_WORKER`) drains the outbox and sends overdue reminders. `dedupeKey` prevents duplicates on retry. A disabled module marks the event processed without side effects.

## Sprint 11

`GET /tenants/:slug/risks` and `GET /tenants/:slug/analytics/overview` return a `Server-Timing` header and `meta.durationMs`. Search `q` uses the same permissions as the list. No new endpoints.

## Sprint 12

Mutations (`POST`/`PUT`/`PATCH`/`DELETE`) on `/api/v1` return `429 rate_limited` and `Retry-After` when the per-IP limit is exceeded. Login uses a separate limit. No new business endpoints.
