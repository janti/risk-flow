import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getObject,
  mimeAllowed,
  objectKey,
  objectKeyBelongsToTenant,
  putObject,
  signObjectAccess,
  verifyObjectAccess,
} from "./storage";

describe("object storage keys and signatures", () => {
  it("prefixes keys with the tenant id and rejects another tenant prefix", () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    const key = objectKey(tenantId, "risk", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "note.pdf");
    expect(key.startsWith(`tenants/${tenantId}/`)).toBe(true);
    expect(objectKeyBelongsToTenant(tenantId, key)).toBe(true);
    expect(objectKeyBelongsToTenant(other, key)).toBe(false);
    expect(objectKeyBelongsToTenant(tenantId, `tenants/${other}/risk/x`)).toBe(false);
  });

  it("rejects expired and tampered signatures", () => {
    const key = "tenants/aaa/risk/bbb/ccc/note.pdf";
    const exp = 1_700_000_060;
    const secret = "test-signing-secret";
    const signature = signObjectAccess("GET", key, exp, secret);
    expect(verifyObjectAccess("GET", key, exp, signature, 1_700_000_000, secret)).toBe("ok");
    expect(verifyObjectAccess("GET", key, exp, signature, 1_700_000_060, secret)).toBe("expired");
    expect(verifyObjectAccess("PUT", key, exp, signature, 1_700_000_000, secret)).toBe("invalid");
    expect(verifyObjectAccess("GET", `tenants/other/${key.slice(8)}`, exp, signature, 1_700_000_000, secret)).toBe(
      "invalid",
    );
  });

  it("blocks executable MIME and extensions", () => {
    expect(mimeAllowed("application/pdf", "report.pdf")).toBe(true);
    expect(mimeAllowed("application/pdf", "malware.exe")).toBe(false);
    expect(mimeAllowed("application/x-msdownload", "ok.pdf")).toBe(false);
  });
});

describe("local object adapter", () => {
  let dir: string | undefined;
  const previous = process.env.OBJECT_STORAGE_DIR;

  afterEach(async () => {
    if (previous === undefined) {
      delete process.env.OBJECT_STORAGE_DIR;
    } else {
      process.env.OBJECT_STORAGE_DIR = previous;
    }
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses writes outside the tenant prefix", async () => {
    dir = await mkdtemp(join(tmpdir(), "riskflow-objects-"));
    process.env.OBJECT_STORAGE_DIR = dir;
    await expect(putObject("../escape.txt", new Uint8Array([1]))).rejects.toThrow(/tenant-prefixed/);
    expect(await getObject("tenants/missing/file.txt")).toBeNull();
  });
});
