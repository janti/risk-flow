# Performance (Sprint 11)

Measurements without OpenTelemetry or Sentry. API lists return `Server-Timing` (`listRisks`, `overview`) and `meta.durationMs`.

## Budgets

| Metric | Budget | Note |
|---|---|---|
| `GET /risks` (limit 25, seed + indexes) | p95 &lt; 200 ms server | `Server-Timing: listRisks` |
| `GET /analytics/overview` (12 months) | p95 &lt; 500 ms server | authorised aggregate |
| First page of the risk list | keyset, not offset | `created_at, id` |
| Dashboard overdue list | max 25 rows | KPI is a separate `count` |

## Indexes (migration `20261022400000_sprint_11_query_indexes`)

- `risks_tenant_created_idx` `(tenant_id, created_at, id)` — default order
- `risks_tenant_org_unit_idx`, `risks_tenant_owner_idx`, `risks_tenant_category_idx`
- `risk_assessments_type_assessed_idx`
- `pg_trgm` + `btree_gin`: `risks_title_trgm_idx` `(tenant_id, title)`, `risks_code_trgm_idx` `(tenant_id, code)` for ILIKE search

Plans are verified in `packages/database/src/query-plan.test.ts` (2000 extra rows + seed). List `LIMIT 26` uses `risks_tenant_created_idx`. GIN indexes are in place; on a ~2k-row tenant PostgreSQL may still filter ILIKE from the heap after the tenant btree because that is cheaper than GIN. GIN becomes cheaper on larger datasets.

## Local measurements

Values filled after `packages/database/src/query-plan.test.ts` (seed + 2000 extra risks, local PostgreSQL):

| Query | Target | Result |
|---|---|---|
| List `ORDER BY created_at DESC, id DESC LIMIT 26` | &lt; 200 ms | under 200 ms (query-plan test) |
| ILIKE search `%trgmneedle%` LIMIT 26 | &lt; 200 ms | under 200 ms (query-plan test) |
| HTTP `GET /risks?limit=25` | p95 &lt; 200 ms | `listRisks;dur=10` on Acme seed |
| Plan, list | `risks_tenant_created_idx` | confirmed |
| Plan, search | GIN indexes present; at 2k rows heap filter may win | indexes verified |

HTTP-level (`Server-Timing`) is measured in the browser against the dev server; it includes the auth and RLS wrapper.

Local measurement 2026-10-22 (Acme, seed, dev server): `GET /api/v1/tenants/acme/risks?limit=25` → `Server-Timing: listRisks;dur=10` (`meta.durationMs` 10). The 200 ms budget is met.

## Query analysis

Typical list query:

```sql
SELECT id FROM risks
WHERE tenant_id = $1 AND status <> 'archived'
ORDER BY created_at DESC, id DESC
LIMIT 26;
```

Search:

```sql
SELECT id FROM risks
WHERE tenant_id = $1 AND (title ILIKE '%q%' OR code ILIKE '%q%')
LIMIT 26;
```

RLS (`app.tenant_id`) still applies; indexes include `tenant_id`.

## Aggregates

Overview selects only KPI/heatmap fields (`id, status, categoryId, createdAt, category`). Overdue actions are paged to 25 rows; the total comes from a `count` query.

## Open limits

- Heatmap needs the latest assessments per risk; at very large tenants (&gt;50k risks) this must be split.
- CSV/PDF export pages in 100-row batches but is still synchronous HTTP.
- Redis 5.0 is local; BullMQ recommends 6.2+.
- There is no browser RUM beyond Server-Timing (intentional: no Sentry/OTel).
