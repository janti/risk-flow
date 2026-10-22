# Security tests

Negative tests do not use fake authentication.

- RLS SELECT/UPDATE/DELETE/INSERT, attachments, notifications, worker poll: `packages/database/src/tenant-isolation.test.ts`
- Audit append-only and cross-tenant audit: same file
- CSRF, IDOR, platform admin, revoked member: `tests/e2e/auth.spec.ts`
- Security headers, `/health`, `/ready`: `tests/e2e/security.spec.ts`
- Rate-limit unit test: `packages/shared/src/rate-limit.test.ts`

Rate limit 429 is covered by the unit test. E2e does not lower the global limit so other mutation tests keep working.
