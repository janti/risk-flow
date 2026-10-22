# Integration tests

Tenant-eristys (SELECT/INSERT/UPDATE/DELETE, liitokset, aggregaatit, pool-vuoto, audit append-only ja org-yksikön sykli) testataan tiedostossa `packages/database/src/tenant-isolation.test.ts`. Jäsenyys, RBAC ja kutsut: `packages/auth/src/access.test.ts` ja `memberships.test.ts`. Testit kuuluvat `pnpm test` -putkeen.
