import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";

const execFileAsync = promisify(execFile);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_DIR = join(ROOT, ".local");
const POSTGRES_DIR = join(LOCAL_DIR, "postgres");
const REDIS_DIR = join(LOCAL_DIR, "redis");
const REDIS_BIN_DIR = join(LOCAL_DIR, "redis-bin");
const REDIS_PID_FILE = join(LOCAL_DIR, "redis.pid");
const REDIS_LOG_FILE = join(LOCAL_DIR, "redis.log");

const POSTGRES_PORT = 5432;
const REDIS_PORT = 6379;
const OIDC_PORT = 3300;
const OIDC_PID_FILE = join(LOCAL_DIR, "oidc.pid");
const POSTGRES_USER = "riskflow";
const POSTGRES_PASSWORD = "riskflow_dev_only";
const POSTGRES_DATABASE = "riskflow";

const WINDOWS_REDIS_ZIP =
  "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip";

const command = process.argv[2] ?? "start";

await main();

async function main() {
  if (command === "start") {
    await startServices();
    return;
  }
  if (command === "stop") {
    await stopServices();
    return;
  }
  if (command === "status") {
    await printStatus();
    return;
  }
  console.error("Usage: node scripts/dev-services.mjs <start|stop|status>");
  process.exitCode = 1;
}

async function startServices() {
  await mkdir(LOCAL_DIR, { recursive: true });
  const postgres = await startPostgres();
  const redis = await startRedis();
  const oidc = await startOidc();

  console.info("RiskFlow local services are running (no Docker).");
  console.info(`  PostgreSQL  postgresql://${POSTGRES_USER}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DATABASE}`);
  console.info(`  Redis       redis://127.0.0.1:${REDIS_PORT}`);
  console.info(`  OIDC        http://127.0.0.1:${OIDC_PORT}`);
  console.info("Press Ctrl+C to stop.");

  const shutdown = async (signal) => {
    console.info(`\nStopping services (${signal})...`);
    await oidc.stop();
    await redis.stop();
    await postgres.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await new Promise(() => undefined);
}

async function stopServices() {
  await stopOidc();
  await stopRedis();
  await stopPostgres();
  console.info("Local services stopped.");
}

async function printStatus() {
  const postgresUp = await isPortOpen(POSTGRES_PORT);
  const redisUp = await isPortOpen(REDIS_PORT);
  const oidcUp = await isPortOpen(OIDC_PORT);
  console.info(`PostgreSQL :${POSTGRES_PORT} ${postgresUp ? "up" : "down"}`);
  console.info(`Redis      :${REDIS_PORT} ${redisUp ? "up" : "down"}`);
  console.info(`OIDC       :${OIDC_PORT} ${oidcUp ? "up" : "down"}`);
  process.exitCode = postgresUp && redisUp && oidcUp ? 0 : 1;
}

async function startPostgres() {
  const pg = createPostgres();

  if (await isPortOpen(POSTGRES_PORT)) {
    console.info(`PostgreSQL already listening on ${POSTGRES_PORT}.`);
    return {
      stop: async () => {
        await pg.stop().catch(() => undefined);
      },
    };
  }

  if (!existsSync(join(POSTGRES_DIR, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(POSTGRES_DATABASE);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) {
      throw error;
    }
  }
  console.info("PostgreSQL 16 started.");
  return {
    stop: async () => {
      await pg.stop().catch(() => undefined);
    },
  };
}

async function stopPostgres() {
  const pg = createPostgres();
  await pg.stop().catch(() => undefined);
}

function createPostgres() {
  return new EmbeddedPostgres({
    databaseDir: POSTGRES_DIR,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    port: POSTGRES_PORT,
    persistent: true,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
}

async function startOidc() {
  if (await isPortOpen(OIDC_PORT)) {
    console.info(`OIDC already listening on ${OIDC_PORT}.`);
    return { stop: async () => undefined };
  }

  const child = spawn(process.execPath, [join(ROOT, "scripts/dev-oidc.mjs")], {
    stdio: "inherit",
    windowsHide: true,
    env: process.env,
  });
  if (child.pid) {
    await writeFile(OIDC_PID_FILE, String(child.pid), "utf8");
  }
  await waitForPort(OIDC_PORT, 15_000);
  console.info("OIDC started.");
  return {
    stop: async () => {
      child.kill();
      await rm(OIDC_PID_FILE, { force: true });
    },
  };
}

async function stopOidc() {
  try {
    const pid = Number((await readFile(OIDC_PID_FILE, "utf8")).trim());
    if (Number.isInteger(pid) && pid > 0) {
      process.kill(pid);
    }
  } catch {
    // Process or pid file may already be gone.
  }
  await rm(OIDC_PID_FILE, { force: true });
}

async function startRedis() {
  if (await isPortOpen(REDIS_PORT)) {
    console.info(`Redis already listening on ${REDIS_PORT}.`);
    return { stop: async () => undefined };
  }

  const binary = await resolveRedisBinary();
  await mkdir(REDIS_DIR, { recursive: true });
  const log = createWriteStream(REDIS_LOG_FILE, { flags: "a" });
  const child = spawn(binary, ["--port", String(REDIS_PORT), "--bind", "127.0.0.1", "--dir", REDIS_DIR], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout?.pipe(log);
  child.stderr?.pipe(log);

  if (child.pid) {
    await writeFile(REDIS_PID_FILE, String(child.pid), "utf8");
  }

  await waitForPort(REDIS_PORT, 15_000);
  console.info("Redis started.");

  return {
    stop: async () => {
      child.kill();
      await rm(REDIS_PID_FILE, { force: true });
    },
  };
}

async function stopRedis() {
  try {
    const pid = Number((await readFile(REDIS_PID_FILE, "utf8")).trim());
    if (Number.isInteger(pid) && pid > 0) {
      process.kill(pid);
    }
  } catch {
    // Process or pid file may already be gone.
  }
  await rm(REDIS_PID_FILE, { force: true });
}

async function resolveRedisBinary() {
  const fromPath = await findOnPath(process.platform === "win32" ? "redis-server.exe" : "redis-server");
  if (fromPath) {
    return fromPath;
  }

  if (process.platform === "win32") {
    return downloadWindowsRedis();
  }

  throw new Error(
    "redis-server was not found. Install it with `brew install redis` or `sudo apt install redis-server`, then retry.",
  );
}

async function downloadWindowsRedis() {
  const exe = join(REDIS_BIN_DIR, "redis-server.exe");
  try {
    await readFile(exe);
    return exe;
  } catch {
    // Download on first run.
  }

  await mkdir(REDIS_BIN_DIR, { recursive: true });
  const zipPath = join(LOCAL_DIR, "redis-windows.zip");
  console.info("Downloading open-source Redis for Windows (no account required)...");
  const response = await fetch(WINDOWS_REDIS_ZIP);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Redis: HTTP ${response.status}`);
  }
  await pipeline(response.body, createWriteStream(zipPath));
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${REDIS_BIN_DIR}' -Force`,
  ]);
  await rm(zipPath, { force: true });
  return exe;
}

async function findOnPath(binary) {
  const command = process.platform === "win32" ? "where" : "which";
  try {
    const { stdout } = await execFileAsync(command, [binary]);
    const first = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    return first;
  } catch {
    return undefined;
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
