# Suorituskyky (Sprint 11)

Mittaukset ilman OpenTelemetryä tai Sentryä. API-listat palauttavat `Server-Timing` (`listRisks`, `overview`) ja `meta.durationMs`.

## Budjetit

| Mittari | Budjetti | Huomio |
|---|---|---|
| `GET /risks` (limit 25, seed + indeksit) | p95 &lt; 200 ms palvelin | `Server-Timing: listRisks` |
| `GET /analytics/overview` (12 kk) | p95 &lt; 500 ms palvelin | valtuutettu aggregaatti |
| Riskilistan ensimmäinen sivu | keyset, ei offset | `created_at, id` |
| Dashboardin myöhässä-lista | max 25 riviä | KPI on erillinen `count` |

## Indeksit (migraatio `20261022400000_sprint_11_query_indexes`)

- `risks_tenant_created_idx` `(tenant_id, created_at, id)` — oletusjärjestys
- `risks_tenant_org_unit_idx`, `risks_tenant_owner_idx`, `risks_tenant_category_idx`
- `risk_assessments_type_assessed_idx`
- `pg_trgm` + `btree_gin`: `risks_title_trgm_idx` `(tenant_id, title)`, `risks_code_trgm_idx` `(tenant_id, code)` ILIKE-haulle

Suunnitelmat varmennetaan testissä `packages/database/src/query-plan.test.ts` (2000 lisäriviä + seed). Listan `LIMIT 26` käyttää `risks_tenant_created_idx`. GIN-indeksit ovat paikallaan; noin 2k rivin tenantissa PostgreSQL voi yhä suodattaa ILIKE:n heapista tenant-btreen jälkeen, koska se on halvempaa kuin GIN. GIN tulee edulliseksi suuremmilla aineistoilla.

## Paikalliset mittaukset

Arvot täytetään `packages/database/src/query-plan.test.ts` -ajon jälkeen (seed + 2000 lisäriskiä, paikallinen PostgreSQL):

| Kysely | Tavoite | Tulos |
|---|---|---|
| Lista `ORDER BY created_at DESC, id DESC LIMIT 26` | &lt; 200 ms | alle 200 ms (query-plan-testi) |
| ILIKE-haku `%trgmneedle%` LIMIT 26 | &lt; 200 ms | alle 200 ms (query-plan-testi) |
| HTTP `GET /risks?limit=25` | p95 &lt; 200 ms | `listRisks;dur=10` Acme-seedillä |
| Suunnitelma, lista | `risks_tenant_created_idx` | vahvistettu |
| Suunnitelma, haku | GIN-indeksit olemassa; 2k rivillä heap-suodatus voi voittaa | indeksit varmennettu |

HTTP-taso (`Server-Timing`) mitataan selaimessa kehityspalvelimelta; se sisältää auth- ja RLS-kääreen.

Paikallinen mittaus 2026-10-22 (Acme, seed, kehityspalvelin): `GET /api/v1/tenants/acme/risks?limit=25` → `Server-Timing: listRisks;dur=10` (`meta.durationMs` 10). Budjetti 200 ms täyttyy.

## Query-analyysi

Tyypillinen listakysely:

```sql
SELECT id FROM risks
WHERE tenant_id = $1 AND status <> 'archived'
ORDER BY created_at DESC, id DESC
LIMIT 26;
```

Haku:

```sql
SELECT id FROM risks
WHERE tenant_id = $1 AND (title ILIKE '%q%' OR code ILIKE '%q%')
LIMIT 26;
```

RLS (`app.tenant_id`) on yhä voimassa; indeksit sisältävät `tenant_id`:n.

## Aggregaatit

Overview valitsee vain KPI/heatmap-kentät (`id, status, categoryId, createdAt, category`). Myöhässä olevat toimenpiteet sivutetaan 25 riviin; kokonaismäärä tulee `count`-kyselystä.

## Avoimet rajat

- Heatmap tarvitsee viimeisimmät arvioinnit per riski; erittäin suurilla tenanteilla (&gt;50k riskiä) tämä pitää hajauttaa.
- CSV/PDF-vienti sivuttaa 100 rivin erissä mutta on yhä synkroninen HTTP.
- Redis 5.0 on paikallinen; BullMQ suosittelee 6.2+.
- Server-Timingin lisäksi ei ole selain-RUM-mittausta (tietoinen: ei Sentryä/OTeliä).
