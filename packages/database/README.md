# @riskflow/database

Prisma schema, SQL migrations, FORCE RLS, and the tenant transaction wrapper.

Local PostgreSQL is started from the repo root with `pnpm services:start` (no Docker).

## Public API

Route handlers use only `createTenantDatabase`:

```ts
import { createTenantDatabase } from "@riskflow/database";

const db = createTenantDatabase(process.env.DATABASE_URL_APP!);
const risks = await db.withTenant(tenantId, (tx) => tx.risk.findMany());
```

A raw `PrismaClient` value is not exported. Tenant context is set inside the transaction with `set_config(..., true)` = `SET LOCAL`.

## Migration and seed

The owner role (`DATABASE_URL`) runs migrations and seed. Runtime roles `riskflow_app` / `riskflow_worker` do not own tables and do not have `BYPASSRLS`.

```bash
pnpm db:migrate
pnpm db:seed
```

Seed creates tenants `acme` and `globex` and Sprint 03 users (admin, manager, employee, revoked, platform-admin).
