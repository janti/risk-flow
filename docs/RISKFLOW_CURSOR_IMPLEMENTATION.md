# RiskFlow — Cursor implementation package v1.0

## Mission and boundaries
Build a real database-backed, multi-tenant, industry-neutral enterprise risk management SaaS with React, Next.js App Router, TypeScript, PostgreSQL and Prisma. The first pilot MVP must let a tenant create and assess risks, assign actions, approve risk treatments, inspect role-specific dashboards, customize risk forms, and enable entitled modules. All business data must be tenant-isolated. No vendor contribution is needed for routine tenant-level configuration. Advanced visual workflow/dashboard builders are later releases; model definitions must be versionable from day one.

### Definition of done for every feature
- Authentication and tenant membership enforced server-side; authorization is checked per operation and record.
- Zod validation on inputs, predictable typed errors, pagination on list endpoints.
- Tests cover positive, forbidden, wrong-tenant and invalid-input cases.
- Audit events for security-relevant and business-critical writes.
- Accessibility: labels, focus order, keyboard controls, contrast, empty/loading/error states.
- Typecheck, lint, unit/integration tests pass; no secrets in repository.

## Technology decisions
- pnpm + Turborepo, Next.js App Router, React, strict TypeScript.
- Tailwind, shadcn/ui, Radix, Lucide, React Hook Form, Zod, TanStack Table, Recharts, dnd-kit.
- PostgreSQL 16+, Prisma ORM; SQL migrations for PostgreSQL RLS policies.
- Auth.js with a real OIDC provider; identity does not imply tenant access.
- Redis + BullMQ worker for emails, reminders and export jobs.
- S3-compatible object storage with private buckets and signed short-lived URLs.
- Vitest, Playwright, axe-based accessibility tests; OpenTelemetry + Sentry.
- Modular monolith; domain packages have no direct React dependency.

## Repository
```
riskflow/
  apps/web/app/(auth), app/(tenant)/[tenantSlug], app/api/v1
  apps/web/features/{risks,actions,assessments,dashboards,forms,admin}
  apps/worker
  packages/{ui,database,auth,tenant,permissions,risk-engine,form-engine,workflow-engine,analytics,module-registry,shared}
  modules/{risk-register,incidents,audits,vendor-risk,continuity}
  tests/{integration,e2e,security}
  docs/{PRD,ARCHITECTURE,DATABASE,SECURITY,DESIGN_SYSTEM,API,DECISIONS,ROADMAP}.md
  .cursor/rules/
```

## Database model — recommended tables
Every tenant-scoped table includes tenant_id UUID NOT NULL, created_at and updated_at; mutable critical records also have created_by and updated_by. Use compound FKs containing tenant_id for all intra-tenant references. Database constraints and RLS are mandatory. Avoid storing tenant-sensitive material in global users table.

| Table | Main columns | Constraints/relationships |
|---|---|---|
| tenants | id, slug, name, status, locale, timezone | unique(slug) |
| users | id, auth_subject, email, display_name | unique(auth_subject) |
| memberships | id, tenant_id, user_id, status | unique(tenant_id,user_id) |
| org_units | id, tenant_id, parent_id, name, type | composite self-FK; prevent cycles |
| org_unit_memberships | id, tenant_id, membership_id, org_unit_id | unique membership+unit |
| roles | id, tenant_id, key, label, is_system | unique(tenant_id,key) |
| permissions | key, description | global permission catalog |
| role_permissions | tenant_id, role_id, permission_key | composite FKs |
| membership_roles | tenant_id, membership_id, role_id, org_unit_id nullable | scoped grants |
| module_catalog | key, version, dependencies_json | global registry |
| tenant_entitlements | tenant_id, module_key, entitled | controlled by platform |
| tenant_modules | tenant_id, module_key, enabled, settings_json | enabled requires entitlement |
| risk_categories | id, tenant_id, parent_id, name, code | unique(tenant_id,code) |
| risks | id, tenant_id, code, title, description, category_id, org_unit_id, owner_membership_id, status, form_version_id, custom_values_json, version, archived_at | unique(tenant_id,code); optimistic concurrency |
| risk_assessments | id, tenant_id, risk_id, assessment_type, likelihood, impact, score, rating, scoring_version_id, rationale, assessed_by, assessed_at | append-only assessments |
| scoring_models | id, tenant_id, key, version, definition_json, published_at | immutable published versions |
| risk_treatments | id, tenant_id, risk_id, strategy, target_date, acceptance_reason, approved_by | avoid/reduce/share/accept |
| actions | id, tenant_id, risk_id, title, description, assignee_membership_id, due_at, status, completed_at | tenant+status+due index |
| approvals | id, tenant_id, entity_type, entity_id, stage, approver_membership_id, decision, decided_at, comment | authorization per entity |
| form_definitions | id, tenant_id, key, name, target_entity | unique(tenant_id,key) |
| form_versions | id, tenant_id, definition_id, version, schema_json, ui_json, status, published_at | unique(definition_id,version); immutable published |
| workflow_definitions | id, tenant_id, key, name | unique(tenant_id,key) |
| workflow_versions | id, tenant_id, definition_id, version, definition_json, status | immutable published |
| workflow_instances | id, tenant_id, definition_version_id, entity_type, entity_id, state | validated transitions |
| dashboard_definitions | id, tenant_id, name, audience_json, widgets_json, published_at | visibility scoped |
| attachments | id, tenant_id, entity_type, entity_id, object_key, filename, mime, size, scan_status | private storage only |
| notifications | id, tenant_id, membership_id, type, payload_json, read_at | scoped recipient |
| audit_events | id, tenant_id, actor_user_id, action, entity_type, entity_id, occurred_at, before_json, after_json, request_id | append-only, restricted access |
| outbox_events | id, tenant_id, type, payload_json, processed_at | transactional outbox |

### Prisma schema excerpts (illustrative; complete in Sprint 2)
```prisma
model Tenant {
  id String @id @default(uuid()) @db.Uuid
  slug String @unique
  name String
  memberships Membership[]
  risks Risk[]
}
model Membership {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid
  userId String @map("user_id") @db.Uuid
  status String
  tenant Tenant @relation(fields: [tenantId], references: [id])
  @@unique([tenantId, userId])
  @@unique([tenantId, id])
}
model Risk {
  id String @id @default(uuid()) @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid
  code String
  title String
  description String?
  status String
  customValues Json @default("{}") @map("custom_values_json")
  version Int @default(1)
  tenant Tenant @relation(fields: [tenantId], references: [id])
  @@unique([tenantId, code])
  @@unique([tenantId, id])
  @@index([tenantId, status])
}
```
Prisma models above are partial and intentionally do not yet contain every relation or migration. Generate full schema from table specification, then review all generated SQL.

### RLS and connection safety
- Use non-owner, non-BYPASSRLS runtime database role; FORCE ROW LEVEL SECURITY on tenant tables.
- Set tenant identity using `SET LOCAL app.tenant_id = '<uuid>'` **inside each transaction**. Do not use session-level SET in pooled connections.
- Policies require tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid, for both USING and WITH CHECK.
- All reads and writes run through a tenant transaction context wrapper; never expose unrestricted Prisma client to route handlers.
- Separate admin migrations and background worker permissions. Worker jobs carry verified tenant context, never user-supplied tenant identifiers.
- Run negative tests for select, update, delete, insert, joins, aggregates, attachment URLs, queue jobs and cross-tenant object references.
- Prevent ambiguous organization selection: derive tenant from authenticated membership, check slug against membership and authorize active role.

Example migration fragment:
```sql
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_risks ON risks
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
```

## Permission model
Permission keys: `risk:read`, `risk:create`, `risk:update`, `risk:archive`, `risk:assess`, `risk:approve`, `action:assign`, `action:complete`, `analytics:read`, `form:manage`, `module:manage`, `users:manage`, `audit:read`. Check membership, permission, org-unit scope, ownership and record visibility. Default deny. Platform administrators have no automatic tenant-data read access. Support explicit audited, time-limited break-glass procedures only if subsequently required.

## API contract v1
Base `/api/v1`; use stable JSON response envelopes `{data,meta}` and errors `{error:{code,message,details?,requestId}}`. Session cookie with CSRF protection; no tenant ID trusted from JSON body. Tenant resolved from route `/t/:tenantSlug` or verified tenant header and membership. UUIDs are opaque; server determines actor/tenant.

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | /me | authenticated | user and memberships |
| GET | /tenants/:slug/context | member | enabled modules, org, permissions |
| GET/POST | /tenants/:slug/risks | risk:read/create | list/search/create risks |
| GET/PATCH | /tenants/:slug/risks/:id | risk:read/update | detail/optimistic update |
| POST | /tenants/:slug/risks/:id/archive | risk:archive | soft archive |
| GET/POST | /tenants/:slug/risks/:id/assessments | risk:read/assess | append assessment |
| GET/POST | /tenants/:slug/risks/:id/actions | risk:read/action:assign | action list/create |
| PATCH | /tenants/:slug/actions/:id | action:complete or action:assign | update action |
| POST | /tenants/:slug/risks/:id/approvals | risk:approve | approve/reject with reason |
| GET | /tenants/:slug/analytics/overview | analytics:read | authorized aggregates |
| GET | /tenants/:slug/analytics/heatmap | analytics:read | matrix counts |
| GET/POST | /tenants/:slug/forms | form:manage | definitions |
| GET/POST | /tenants/:slug/forms/:id/versions | form:manage | version create/list |
| POST | /tenants/:slug/forms/:id/versions/:version/publish | form:manage | validate/publish |
| GET/PATCH | /tenants/:slug/modules | module:manage | enabled entitled modules |
| GET/POST | /tenants/:slug/memberships | users:manage | list/invite |
| GET | /tenants/:slug/audit-events | audit:read | paginated events |
| POST | /tenants/:slug/attachments/upload-intent | entity:update | signed upload with limits |
| GET | /tenants/:slug/exports/risks.csv | risk:read | scoped CSV export |

List query: `cursor`, `limit` (default 25 max 100), `status`, `categoryId`, `orgUnitId`, `ownerId`, `q`, `sort`. Use keyset pagination. `PATCH /risks/:id` requires `version` and returns 409 CONFLICT on stale version. Risk create returns 201. Invalid 400/422, unauthenticated 401, forbidden 403, missing 404, rate limit 429. Do not reveal existence of cross-tenant objects.

### API examples
```json
POST /api/v1/tenants/acme/risks
{
  "title":"Single-source supplier outage",
  "description":"Critical component has no alternate supplier",
  "categoryId":"<uuid>",
  "orgUnitId":"<uuid>",
  "ownerMembershipId":"<uuid>",
  "customValues":{"businessImpact":"production"}
}
```
```json
POST /api/v1/tenants/acme/risks/<risk-id>/assessments
{"assessmentType":"inherent","likelihood":4,"impact":5,"rationale":"Supplier concentration","scoringVersionId":"<uuid>"}
```
```json
PATCH /api/v1/tenants/acme/risks/<risk-id>
{"version":3,"title":"Updated title"}
```

## UI routes and components
Routes under `/t/[tenantSlug]`: `/home`, `/risks`, `/risks/new`, `/risks/[riskId]`, `/actions`, `/analytics`, `/settings/organization`, `/settings/users`, `/settings/roles`, `/settings/forms`, `/settings/forms/[formId]/edit`, `/settings/modules`, `/settings/audit`.

Shared components: `AppShell`, `TenantSwitcher`, `SideNavigation`, `Breadcrumbs`, `CommandMenu`, `RoleAwareNavigation`, `PageHeader`, `DataTable`, `FilterBar`, `StatusBadge`, `EmptyState`, `ErrorState`, `Skeleton`, `ConfirmDialog`, `PermissionGate`, `AuditTimeline`.

Risk components: `RiskTable`, `RiskFilterBar`, `RiskDetailHeader`, `RiskFormRenderer`, `RiskAssessmentPanel`, `RiskMatrix`, `RiskHistory`, `RiskTreatmentPanel`, `RiskActionList`, `ApprovalTimeline`.

Admin components: `OrganizationTree`, `MemberInviteDialog`, `RolePermissionMatrix`, `ModuleToggleList`, `FormBuilderCanvas`, `FieldPalette`, `FieldPropertiesPanel`, `ConditionalRuleEditor`, `FormPreview`, `PublishVersionDialog`.

Analytics components: `KpiCard`, `RiskTrendChart`, `RiskCategoryBreakdown`, `OverdueActionsChart`, `RiskHeatmap`, `DashboardFilterBar`.

## Form engine contract
Definition: `{id,key,targetEntity,versions[]}`. Version: `{version,status,schema,ui,createdBy,publishedAt}`. Field shape: `{id,key,type,label,helpText,required,defaultValue,options,validation,visibility,permissions}`. Supported MVP types: shortText, longText, number, date, select, multiSelect, boolean, user, orgUnit. Add attachments/repeating groups later. Conditional rules are AST expressions (and/or/not, equals, in, greaterThan), never executable code. Published versions immutable; existing risk records reference the version used at creation. Provide preview and rollback via publishing a new version derived from an old one. Deleting fields requires impact preview; retain historical values.

## Risk engine contract
`score = likelihood * impact` for initial 3x3 or 5x5 scoring. Store assessment model version and derived score at time of assessment. Allow tenant-defined thresholds; avoid changing historical classifications when a model changes. Track inherent and residual assessments separately. Risk acceptance requires authority check and justification. Do not infer residual score simply by subtracting arbitrary control values.

## Twelve two-week sprints
Each sprint includes a ready-to-paste Cursor prompt, acceptance criteria and explicit dependencies. The prompt should be used only after the preceding sprint has passed its gates.

### Sprint 01 — Repo, CI, design system
**Prompt:**
> Act as a senior Next.js architect. Scaffold a pnpm/Turborepo monorepo with apps/web, apps/worker and packages/ui, shared, database, tenant, permissions, risk-engine, form-engine, module-registry. Use Next.js App Router, strict TypeScript, Tailwind, shadcn/ui, Zod, ESLint, Prettier, Vitest and Playwright. Implement responsive AppShell, tenant-aware navigation placeholders, semantic typography, dark/light theme and basic empty/loading/error states. Add Docker Compose for local PostgreSQL and Redis, env.example, CI typecheck/lint/test workflow and docs/ARCHITECTURE.md. Do not implement fake authentication. Document every command and run checks.
**Acceptance:** fresh clone starts locally; `/health` works; mobile sidebar keyboard accessible; CI green; no secrets committed.

### Sprint 02 — PostgreSQL schema and RLS
**Prompt:**
> Implement Prisma schema and SQL migrations for tenants, users, memberships, org units, roles, permissions, risk categories, risks and audit events, using the agreed data model. Every tenant table must have tenant_id, composite foreign keys, tenant indexes and RLS USING/WITH CHECK policies with FORCE RLS. Implement tenant-scoped transaction wrapper using SET LOCAL; separate migration and runtime roles. Add seed data for two tenants and integration tests proving cross-tenant SELECT/INSERT/UPDATE/DELETE and reference attacks fail. Do not expose raw Prisma client from API routes.
**Acceptance:** migrations reproducible; negative tests pass; pool reuse does not leak tenant context.

### Sprint 03 — Identity, memberships, RBAC/ABAC
**Prompt:**
> Integrate Auth.js with OIDC provider; implement authenticated session, tenant membership validation, tenant switcher, employee/manager/risk-manager/tenant-admin role presets, permission keys, scoped org-unit access and server-side authorization helpers. Build login/logout, tenant selection, access-denied states and invite acceptance with expiring tokens. Default deny; platform admin must not gain automatic access to tenant business data. Test unauthorized and wrong-tenant API access.
**Acceptance:** two organizations have independent users and roles; revoked member immediately loses access; forbidden operations return 403/404 without data leakage.

### Sprint 04 — Risk register CRUD
**Prompt:**
> Implement risk register with real PostgreSQL persistence: list, search, keyset pagination, create, edit, archive, detail and audit events. Use typed service/repository layer, Zod validation, optimistic concurrency with version and consistent API errors. Build RiskTable, filters, create/edit form, detail header, owner/category/unit selectors and empty/loading/error states. Verify all IDs and relations belong to active tenant. Include Playwright employee and risk-manager flows.
**Acceptance:** tenant A creates risk; tenant B cannot access it by ID; concurrent edit yields 409; records persist across restart.

### Sprint 05 — Assessments and scoring
**Prompt:**
> Implement versioned 3x3/5x5 scoring models, immutable inherent/residual assessment records, tenant-specific thresholds and matrix visualization. Assessment permissions must be enforced server-side. Build RiskAssessmentPanel and clickable RiskMatrix whose cell filters the risk list. Store model version, scores and rationale; historical results remain stable after model updates. Include boundary tests and cross-tenant tests.
**Acceptance:** correct scores, heatmap counts match authorized list, previous assessments remain available, historical values unchanged.

### Sprint 06 — Actions, treatments, approvals
**Prompt:**
> Implement treatment strategies, risk actions, assignees, due dates, state transitions and basic configurable approval stages. Add ActionList, MyTasks, TreatmentPanel and ApprovalTimeline. Send events through transactional outbox; prohibit approving own submission when tenant policy requires separation of duties. Implement org-unit scoping and tests for unauthorized assignments and approvals.
**Acceptance:** full identify→assess→treat→approve→complete flow works; overdue actions visible; decisions auditable.

### Sprint 07 — Role-based dashboards and analytics
**Prompt:**
> Build employee home, manager dashboard, risk manager analytics and tenant admin overview using authorized SQL aggregations. Implement KPI cards, 5x5 heatmap, monthly trends, risk categories and overdue actions. Ensure every metric respects tenant, org-unit and record visibility, including drilldowns and exports. Use real seeded data and explicit date windows. Add tests reconciling chart totals with underlying permitted records.
**Acceptance:** users see only authorized aggregates; clicking chart opens matching filtered records; responsive and accessible.

### Sprint 08 — Dynamic forms and publishing
**Prompt:**
> Implement tenant-scoped form definitions, immutable versions, schema validation and a metadata-driven renderer. Build a usable form editor with field palette, drag/reorder, property panel, required flags, choices, preview and publish action. Support safe conditional rules AST; reject arbitrary scripts. Bind custom field values to risks and keep old records renderable against original schema. Add versioning, conflict and migration impact tests.
**Acceptance:** tenant admin adds and publishes a field without code deployment; employee fills it; historical records remain readable; tenant B cannot use tenant A's form.

### Sprint 09 — Modules, tenant settings and organization
**Prompt:**
> Implement module registry, platform entitlements, tenant module switches and dependency validation. Enforce module enablement at API/service layer, not only navigation. Build module settings, organization tree, role permission matrix and locale/branding settings. Disabling a module must preserve records and background jobs must respect disablement. Add tests for unentitled modules and cyclic dependencies.
**Acceptance:** tenant admin can enable entitled module; cannot enable unentitled module; disabled module cannot be called through direct API.

### Sprint 10 — Attachments, notifications, exports, audit
**Prompt:**
> Implement private S3-compatible attachment upload intent, MIME/size checks, antivirus scan state and authorized download URLs. Add in-app notifications, worker reminders, CSV risk export with injection-safe cell escaping, basic PDF summary and paginated immutable audit viewer. Add retry/idempotency via outbox and BullMQ. Test wrong-tenant object keys, URL expiry and export scoping.
**Acceptance:** file access is tenant-safe; failed jobs retry without duplicate effects; exported totals match permitted records.

### Sprint 11 — UX quality, accessibility and performance
**Prompt:**
> Perform structured usability and accessibility hardening across employee, manager and admin journeys. Fix keyboard navigation, focus, forms, responsive tables, error states and WCAG 2.2 AA issues. Add performance budgets, query analysis, pagination and indexes. Improve navigation/search and instrument core user journeys. Do not add new modules. Document measured results and unresolved issues.
**Acceptance:** no critical accessibility findings; documented performance benchmarks on realistic dataset; essential tasks usable on mobile.

### Sprint 12 — Security, pilot readiness and deployment
**Prompt:**
> Prepare production deployment with staging/prod separation, secrets management, database backups and restore drill, monitoring, alerting, rate limits, security headers, audit retention policy, data export/deletion process and incident response runbook. Run penetration-test checklist, RLS negative suite, end-to-end acceptance tests and disaster recovery exercise. Provide release notes, admin onboarding guide, deployment checklist and explicit go/no-go report. Never claim compliance certification without independent assessment.
**Acceptance:** no unresolved critical/high vulnerabilities; backup restore proven; rollback rehearsed; two pilot tenants onboarded without direct DB edits.

## Sprint command template
At the start of every Cursor session:
```
Read docs/PRD.md, docs/ARCHITECTURE.md, docs/SECURITY.md,
docs/DATABASE.md, docs/API.md and .cursor/rules/*.
Inspect existing code before modifying it.
Implement ONLY Sprint NN. First give a short plan and affected files.
Make incremental changes and run typecheck, lint and relevant tests.
Provide a completion summary, changed files, test output,
remaining risks and a proposed next sprint. Do not fabricate tests.
```

## Testing matrix
- Unit: scoring thresholds, conditional expressions, permissions, workflow transitions.
- Integration: Prisma transactions, RLS, composite FK tenant isolation, API status/error shapes, audit events.
- E2E: tenant invite/login, employee risk report, manager assessment, action completion, form publish, module switch.
- Security: IDOR, CSRF, stored XSS, file upload, CSV injection, rate limiting, cross-tenant aggregates and caches, token expiration.
- Operations: queue retry/idempotency, backup restore, zero-downtime migration compatibility, environment separation.

## Release gates
**Prototype:** shell and navigation with real auth not yet promised.
**Internal alpha (Sprints 1–5):** tenant-safe risk CRUD and assessments.
**Feature-complete beta (Sprints 1–10):** configurable forms, actions, dashboards, modules, audit and export.
**Pilot-ready MVP (Sprints 1–12):** validated security, UX, operations, backups and customer onboarding.

## Beyond MVP (explicitly excluded)
Visual workflow canvas, full Dashboard Builder, external APIs/webhooks, SAML/SCIM, advanced compliance mappings, third-party risk, BIA/BCM, AI assistant, cross-framework control library, dedicated tenant databases, white-label domains, complex report designer and enterprise billing. Architecture must allow them; do not implement prematurely.

## Project risk register
1. RLS + Prisma pooling misuse → mandatory transaction wrapper, independent security review.
2. Config version changes corrupt historical data → immutable published versions and impact previews.
3. Dashboard aggregates leak data → reuse authorization-aware query predicates and test reconciliation.
4. Broad industry scope creates endless features → generic core first, industry packs later.
5. Cursor-generated changes bypass architecture → small prompts, reviewed migrations, CI gates.
6. Forms become arbitrary-code platform → constrained expression AST and strict validation.
7. Scope exceeds 24 weeks → keep visual workflow/dashboard builders out of MVP.
