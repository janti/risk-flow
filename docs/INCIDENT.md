# Security incident runbook

## Classification

- P1: tenant isolation broken, data leak, authentication bypass
- P2: service outage, mass 500s, worker stuck
- P3: single-user regression

## First 15 minutes

1. Confirm the finding with `/health`, `/ready`, and logs. Do not leak environment variables in responses.
2. Record `x-request-id` and timestamp.
3. If a tenant leak is suspected: stop writes (maintenance / worker stop). Do not repair data with SQL updates to audit.
4. Notify the platform owner. Tell the tenant admin the impact, not another tenant's data.

## Containment and recovery

- Restore the last known-good version (`docs/DEPLOY.md`).
- Preserve `audit_events` (append-only). App/worker cannot DELETE/UPDATE.
- Attachments: do not share signed URLs in logs; they expire.
- Rate limit 429 is not an incident, but a sudden spike is.

## Follow-up

1. Record a timeline, affected tenants (slug, not content), and the fix.
2. Run RLS negatives: `pnpm --filter @riskflow/database test`.
3. Update `docs/PENTEST.md` if a control was missing.
4. Do not claim certification (ISO 27001 or similar) on the basis of this runbook.
