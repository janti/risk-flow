import { config } from "dotenv";
import { resolve } from "node:path";
import { seedDatabase } from "./seed";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://riskflow:riskflow_dev_only@127.0.0.1:5432/riskflow";

await seedDatabase(connectionString);
console.info("Seed completed for tenants acme and globex.");
