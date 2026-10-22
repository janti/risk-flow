# Release notes

## Sprint 12 — pilot-ready MVP

- Staging/production split via `APP_ENV` and secret validation.
- `GET /ready` (PostgreSQL + Redis). `GET /health` remains liveness.
- In-process rate limit on mutations and login (`429 rate_limited`, `Retry-After`).
- Security headers: CSP, HSTS in production, COOP/CORP.
- Backup and restore drill: `pnpm ops:backup`, `pnpm ops:restore-drill`.
- Tenant export and offboarding without app-role DELETE on audit.
- Audit retention is an owner-role DBA script (`pnpm ops:audit-retention`).
- Ops guides: deploy, onboarding, incident, pentest, go/no-go.

The application is not certified against ISO 27001/45001/31000. Standard guidance in the register is advisory, not audit mapping.

## Previous sprints

Sprints 01–11: shell, RLS, Auth.js, register, assessments, actions, dashboards, forms, modules, attachments, UX/accessibility.
