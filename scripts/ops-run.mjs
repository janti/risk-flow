import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2];
const rest = process.argv.slice(3);

if (!command) {
  console.error("Usage: node scripts/ops-run.mjs <backup|restore-drill|tenant-export|tenant-offboard|audit-retention>");
  process.exitCode = 1;
} else {
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawn(pnpm, ["--filter", "@riskflow/database", "ops", command, ...rest], {
    cwd: ROOT,
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
}
