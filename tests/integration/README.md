# Integration tests

Tenant isolation (SELECT/INSERT/UPDATE/DELETE, joins, aggregates, pool leak, audit append-only, and org-unit cycles) is tested in `packages/database/src/tenant-isolation.test.ts`. Membership, RBAC, and invites: `packages/auth/src/access.test.ts` and `memberships.test.ts`. Tests run in the `pnpm test` pipeline.
