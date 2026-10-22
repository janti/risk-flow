import { PrismaClient, type Prisma } from "./generated/client";

const TENANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TenantTransaction = Prisma.TransactionClient;

export type TenantWork<T> = (tx: TenantTransaction) => Promise<T>;

export type TenantDatabase = {
  withTenant: <T>(tenantId: string, work: TenantWork<T>) => Promise<T>;
  withUser: <T>(userId: string, work: TenantWork<T>) => Promise<T>;
  withInviteToken: <T>(tokenHash: string, work: TenantWork<T>) => Promise<T>;
  withWorkerPoll: <T>(work: TenantWork<T>) => Promise<T>;
  withoutTenantContext: <T>(work: TenantWork<T>) => Promise<T>;
  $disconnect: () => Promise<void>;
};

const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/i;

function assertUuid(value: string, label: string): string {
  if (!TENANT_ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

/**
 * Binds a runtime Prisma client to tenant-scoped transactions.
 * Route handlers must use `withTenant` only — never a raw PrismaClient.
 */
export function createTenantDatabase(connectionString: string): TenantDatabase {
  const client = new PrismaClient({
    datasourceUrl: connectionString,
  });

  return {
    async withTenant<T>(tenantId: string, work: TenantWork<T>): Promise<T> {
      const verifiedTenantId = assertUuid(tenantId, "tenant id");

      return client.$transaction(async (tx) => {
        // is_local = true is SET LOCAL: the setting dies with the transaction
        // and cannot leak across pooled connections.
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${verifiedTenantId}, true)`;
        return work(tx);
      });
    },

    async withUser<T>(userId: string, work: TenantWork<T>): Promise<T> {
      const verifiedUserId = assertUuid(userId, "user id");

      return client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${verifiedUserId}, true)`;
        return work(tx);
      });
    },

    async withInviteToken<T>(tokenHash: string, work: TenantWork<T>): Promise<T> {
      if (!TOKEN_HASH_PATTERN.test(tokenHash)) {
        throw new Error("Invalid invite token.");
      }

      return client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.invite_token_hash', ${tokenHash.toLowerCase()}, true)`;
        return work(tx);
      });
    },

    async withWorkerPoll<T>(work: TenantWork<T>): Promise<T> {
      return client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.worker_poll', 'true', true)`;
        return work(tx);
      });
    },

    async withoutTenantContext<T>(work: TenantWork<T>): Promise<T> {
      return client.$transaction(async (tx) => work(tx));
    },

    $disconnect: () => client.$disconnect(),
  };
}

export function createMigratorClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    datasourceUrl: connectionString,
  });
}
