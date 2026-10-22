# Go / no-go (Sprint 12)

Decision: **conditional GO for a closed pilot**. Not GO for open internet production before an independent pentest.

RiskFlow **does not claim** ISO 27001, ISO 45001, or any other compliance certification.

## Acceptance criteria

| Criterion | Result |
|---|---|
| No known critical/high code vulnerabilities | Met on the control checklist; no external pentest |
| Backup restore proven | `pnpm ops:restore-drill` (canary row delete and restore from dump) |
| Rollback rehearsed | Restore previous artefact + dump, see `docs/DEPLOY.md` |
| Two pilot tenants without direct DB membership inserts | acme and globex; users via UI/OIDC invite or direct add |

## GO for a closed pilot if

- Staging `/health` and `/ready` are green
- RLS and e2e tests are green
- Restore drill has been run successfully
- Secrets do not contain `dev_only`
- Two tenants sign in with cross-access blocked

## NO-GO if

- Tenant isolation breaks
- `/ready` leaks secrets or stays 503 without cause
- Backup cannot be restored
- Local seed data or `dev_only` secrets are used in production
