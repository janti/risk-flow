import { resolve } from "node:path";
import { config } from "dotenv";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { drainOutbox, sendOverdueReminders } from "@riskflow/risk-engine";
import { getWorkerDatabase } from "./db";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const db = getWorkerDatabase();
const queueName = "riskflow-jobs";

const queue = new Queue(queueName, { connection });
const worker = new Worker(
  queueName,
  async (job) => {
    if (job.name === "drain-outbox") {
      const summary = await drainOutbox(db);
      console.info(`[riskflow-worker] outbox processed=${summary.processed} skipped=${summary.skipped} disabled=${summary.disabled}`);
      return summary;
    }
    if (job.name === "overdue-reminders") {
      const created = await sendOverdueReminders(db);
      console.info(`[riskflow-worker] overdue reminders created=${created}`);
      return { created };
    }
    throw new Error(`Unknown job ${job.name}`);
  },
  {
    connection,
    concurrency: 1,
  },
);

worker.on("failed", (job, error) => {
  console.error(`[riskflow-worker] job ${job?.name ?? "unknown"} failed: ${error.message}`);
});

async function schedule(): Promise<void> {
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }
  await queue.add("drain-outbox", {}, { repeat: { every: 5_000 } });
  await queue.add("overdue-reminders", {}, { repeat: { every: 60_000 } });
  console.info("[riskflow-worker] BullMQ outbox drain and overdue reminders are running.");
}

async function shutdown(signal: string): Promise<void> {
  console.info(`[riskflow-worker] Received ${signal}, shutting down.`);
  await worker.close();
  await queue.close();
  await connection.quit();
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void schedule().catch((error: unknown) => {
  console.error("[riskflow-worker] failed to start", error);
  process.exit(1);
});
