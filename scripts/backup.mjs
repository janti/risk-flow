import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, [join(ROOT, "scripts/ops-run.mjs"), "backup", ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: "inherit",
  windowsHide: true,
});
child.on("exit", (code) => process.exit(code ?? 1));
