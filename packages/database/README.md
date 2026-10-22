# @riskflow/database

Prisma-skeema, SQL-migraatiot, FORCE RLS ja tenant-transaktiokääre.

Paikallinen PostgreSQL käynnistetään juuresta komennolla `pnpm services:start` (ei Dockeria).

## Julkinen API

Reittikäsittelijät käyttävät vain `createTenantDatabase`:

```ts
import { createTenantDatabase } from "@riskflow/database";

const db = createTenantDatabase(process.env.DATABASE_URL_APP!);
const risks = await db.withTenant(tenantId, (tx) => tx.risk.findMany());
```

Raakaa `PrismaClient`-arvoa ei viedä paketista. Tenant-konteksti asetetaan transaktion sisällä `set_config(..., true)` = `SET LOCAL`.

## Migraatio ja seed

Omistajarooli (`DATABASE_URL`) ajaa migraatiot ja seedin. Ajonaikaiset roolit `riskflow_app` / `riskflow_worker` eivät ole taulujen omistajia eivätkä sisällä `BYPASSRLS`-oikeutta.

```bash
pnpm db:migrate
pnpm db:seed
```

Seed luo tenantit `acme` ja `globex` sekä Sprint 03:n käyttäjät (admin, manager, employee, revoked, platform-admin).
