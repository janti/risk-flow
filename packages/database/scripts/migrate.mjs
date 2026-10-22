import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

config({ path: resolve(repoRoot, ".env") });
process.env.DATABASE_URL ??=
  "postgresql://riskflow:riskflow_dev_only@127.0.0.1:5432/riskflow";

const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
  cwd: packageRoot,
});

process.exit(result.status ?? 1);
