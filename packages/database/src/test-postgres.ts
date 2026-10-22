import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import { seedDatabase } from "./seed";
import { createTenantDatabase, type TenantDatabase } from "./tenant-database";

const execFileAsync = promisify(execFile);

const PACKAGE_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

export type TestDatabase = {
  ownerUrl: string;
  appUrl: string;
  workerUrl: string;
  app: TenantDatabase;
  worker: TenantDatabase;
  stop: () => Promise<void>;
};

export async function startTestDatabase(): Promise<TestDatabase> {
  const databaseDir = await mkdtemp(join(tmpdir(), "riskflow-pg-"));
  const port = 55000 + Math.floor(Math.random() * 1000);
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "riskflow",
    password: "riskflow_dev_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  await postgres.initialise();
  await postgres.start();
  try {
    await postgres.createDatabase("riskflow");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) {
      throw error;
    }
  }

  const ownerUrl = `postgresql://riskflow:riskflow_dev_only@127.0.0.1:${port}/riskflow`;
  const appUrl = `postgresql://riskflow_app:riskflow_app_dev_only@127.0.0.1:${port}/riskflow`;
  const workerUrl = `postgresql://riskflow_worker:riskflow_worker_dev_only@127.0.0.1:${port}/riskflow`;

  await execFileAsync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, DATABASE_URL: ownerUrl },
    shell: true,
  });

  await seedDatabase(ownerUrl);

  const app = createTenantDatabase(appUrl);
  const worker = createTenantDatabase(workerUrl);

  return {
    ownerUrl,
    appUrl,
    workerUrl,
    app,
    worker,
    async stop() {
      await app.$disconnect();
      await worker.$disconnect();
      await postgres.stop().catch(() => undefined);
      await rm(databaseDir, { recursive: true, force: true });
    },
  };
}
