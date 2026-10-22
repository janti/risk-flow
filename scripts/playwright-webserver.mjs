import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const POSTGRES_PORT = 5432;
const OIDC_PORT = 3300;

const AUTH_ENV = {
  AUTH_SECRET: process.env.AUTH_SECRET ?? "riskflow_auth_secret_dev_only_min_32_chars",
  AUTH_URL: process.env.AUTH_URL ?? "http://127.0.0.1:3000",
  AUTH_ISSUER: process.env.AUTH_ISSUER ?? "http://127.0.0.1:3300",
  AUTH_CLIENT_ID: process.env.AUTH_CLIENT_ID ?? "riskflow-web",
  AUTH_CLIENT_SECRET: process.env.AUTH_CLIENT_SECRET ?? "riskflow_oidc_dev_only",
  AUTH_TRUST_HOST: "true",
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgresql://riskflow:riskflow_dev_only@127.0.0.1:5432/riskflow",
  DATABASE_URL_APP:
    process.env.DATABASE_URL_APP ??
    "postgresql://riskflow_app:riskflow_app_dev_only@127.0.0.1:5432/riskflow",
};

const env = { ...process.env, ...AUTH_ENV };
const children = [];

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await main();

async function main() {
  await ensurePostgres();
  await ensureOidc();
  await run("pnpm", ["db:migrate"]);
  await run("pnpm", ["db:seed"]);

  const next = spawn("pnpm", ["--filter", "@riskflow/web", "dev"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: true,
  });
  children.push(next);
  next.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 0);
  });
}

async function ensurePostgres() {
  if (await isPortOpen(POSTGRES_PORT)) {
    return;
  }
  const databaseDir = join(ROOT, ".local", "postgres-e2e");
  await mkdir(databaseDir, { recursive: true });
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "riskflow",
    password: "riskflow_dev_only",
    port: POSTGRES_PORT,
    persistent: true,
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
  children.push({ kill: () => postgres.stop() });
}

async function ensureOidc() {
  if (await isPortOpen(OIDC_PORT)) {
    return;
  }
  const child = spawn(process.execPath, [join(ROOT, "scripts/dev-oidc.mjs")], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  await waitForPort(OIDC_PORT, 15_000);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: "inherit", shell: true });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
      }
    });
  });
}

function shutdown() {
  for (const child of children) {
    child.kill?.();
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

async function waitForPort(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isPortOpen(port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for port ${port}.`);
}
