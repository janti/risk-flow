import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../../..");

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const BLOCKED_EXTENSIONS = [".exe", ".bat", ".cmd", ".js", ".msi", ".dll"];

export function sanitizeFilename(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "") || "file";
  return cleaned.slice(0, 120);
}

export function objectKey(
  tenantId: string,
  entityType: string,
  entityId: string,
  attachmentId: string,
  filename: string,
): string {
  return `tenants/${tenantId}/${entityType}/${entityId}/${attachmentId}/${sanitizeFilename(filename)}`;
}

export function objectKeyBelongsToTenant(tenantId: string, key: string): boolean {
  return key.startsWith(`tenants/${tenantId}/`);
}

export function signingSecret(): string {
  return process.env.OBJECT_SIGNING_SECRET ?? process.env.AUTH_SECRET ?? "riskflow_object_dev_only";
}

export function storageRoot(): string {
  const configured = process.env.OBJECT_STORAGE_DIR;
  if (!configured) {
    return join(REPO_ROOT, ".local", "object-storage");
  }
  return isAbsolute(configured) ? configured : join(REPO_ROOT, configured);
}

export function signObjectAccess(
  method: "GET" | "PUT",
  objectKeyValue: string,
  expiresAtEpochSeconds: number,
  secret = signingSecret(),
): string {
  return createHmac("sha256", secret)
    .update(`${method}\n${objectKeyValue}\n${expiresAtEpochSeconds}`)
    .digest("hex");
}

export function verifyObjectAccess(
  method: "GET" | "PUT",
  objectKeyValue: string,
  expiresAtEpochSeconds: number,
  signature: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
  secret = signingSecret(),
): "ok" | "expired" | "invalid" {
  if (!/^[0-9a-f]{64}$/i.test(signature)) {
    return "invalid";
  }
  if (expiresAtEpochSeconds <= nowEpochSeconds) {
    return "expired";
  }
  const expected = signObjectAccess(method, objectKeyValue, expiresAtEpochSeconds, secret);
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(signature.toLowerCase(), "utf8");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return "invalid";
  }
  return "ok";
}

export function mimeAllowed(mime: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  if (BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return false;
  }
  return ALLOWED_ATTACHMENT_MIME.has(mime);
}

export function scanUploadedObject(mime: string, filename: string): "clean" | "infected" {
  return mimeAllowed(mime, filename) ? "clean" : "infected";
}

export async function putObject(key: string, body: Uint8Array): Promise<void> {
  if (!objectKeyBelongsToTenantPrefix(key)) {
    throw new Error("Object key must be tenant-prefixed.");
  }
  const path = join(storageRoot(), ...key.split("/"));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  if (!objectKeyBelongsToTenantPrefix(key)) {
    return null;
  }
  try {
    return await readFile(join(storageRoot(), ...key.split("/")));
  } catch {
    return null;
  }
}

function objectKeyBelongsToTenantPrefix(key: string): boolean {
  return key.startsWith("tenants/") && !key.includes("..");
}
