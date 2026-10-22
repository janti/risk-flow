import net from "node:net";
import { getAppDatabase } from "./db";

export type ReadyCheck = {
  postgres: boolean;
  redis: boolean;
};

export async function checkReadiness(): Promise<ReadyCheck> {
  const [postgres, redis] = await Promise.all([pingPostgres(), pingRedis(process.env.REDIS_URL)]);
  return { postgres, redis };
}

async function pingPostgres(): Promise<boolean> {
  try {
    await getAppDatabase().withoutTenantContext((tx) => tx.$queryRaw`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export function pingRedis(urlString: string | undefined, timeoutMs = 2_000): Promise<boolean> {
  if (!urlString) {
    return Promise.resolve(false);
  }
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return Promise.resolve(false);
  }
  const port = url.port ? Number(url.port) : 6379;
  const host = url.hostname || "127.0.0.1";
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.on("connect", () => {
      socket.write("*1\r\n$4\r\nPING\r\n");
    });
    socket.on("data", (buffer) => {
      clearTimeout(timer);
      socket.end();
      resolve(buffer.toString().includes("PONG"));
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}
