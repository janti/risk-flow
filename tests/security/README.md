# Security tests

Negatiiviset testit eivät käytä valeautentikaatiota.

- RLS SELECT/UPDATE/DELETE/INSERT, liitteet, ilmoitukset, worker-poll: `packages/database/src/tenant-isolation.test.ts`
- Audit append-only ja cross-tenant audit: sama tiedosto
- CSRF, IDOR, alustan admin, peruttu jäsen: `tests/e2e/auth.spec.ts`
- Suojaotsikot, `/health`, `/ready`: `tests/e2e/security.spec.ts`
- Rate limit -yksikkötesti: `packages/shared/src/rate-limit.test.ts`

Rate limit 429 todennetaan yksikkötestillä. E2e ei laske globaalia rajaa, jotta muut mutaatiotestit eivät hajoa.
