/**
 * Public database API. Route handlers must call `createTenantDatabase(url).withTenant(...)`.
 * `PrismaClient` is intentionally not exported as a value.
 */
export { createTenantDatabase } from "./tenant-database";
export { LOCAL_OIDC_ISSUER, oidcAuthSubject } from "./seed";
export type { TenantDatabase, TenantTransaction, TenantWork } from "./tenant-database";
export type { Prisma } from "./generated/client";
