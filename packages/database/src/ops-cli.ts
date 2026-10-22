import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createMigratorClient } from "./tenant-database";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: join(ROOT, ".env") });
loadEnv({ path: join(ROOT, ".env.example") });

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const command = process.argv[2];

await main();

async function main(): Promise<void> {
  if (command === "backup") {
    await backup();
    return;
  }
  if (command === "restore-drill") {
    await restoreDrill();
    return;
  }
  if (command === "tenant-export") {
    await tenantExport(process.argv[3]);
    return;
  }
  if (command === "tenant-offboard") {
    await tenantOffboard(process.argv[3]);
    return;
  }
  if (command === "audit-retention") {
    await auditRetention();
    return;
  }
  console.error("Usage: tsx src/ops-cli.ts <backup|restore-drill|tenant-export|tenant-offboard|audit-retention>");
  process.exitCode = 1;
}

function ownerUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL (owner/migrator role) is required.");
  }
  return url;
}

function stamp(now = new Date()): string {
  return now.toISOString().slice(0, 19).replace(/[-:T]/g, "").slice(0, 15);
}

function assertSlug(value: string | undefined): string {
  if (!value || !SLUG_PATTERN.test(value)) {
    throw new Error("Tenant slug must match [a-z0-9]+(?:-[a-z0-9]+)*.");
  }
  return value;
}

async function backup(): Promise<void> {
  const prisma = createMigratorClient(ownerUrl());
  try {
    const snapshot = await logicalSnapshot(prisma);
    const dir = join(ROOT, ".local", "backups");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `riskflow-${stamp()}.json`);
    await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.info(`Logical snapshot: ${path}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function restoreDrill(): Promise<void> {
  const prisma = createMigratorClient(ownerUrl());
  try {
    const acme = await prisma.tenant.findUniqueOrThrow({ where: { slug: "acme" } });
    const code = `DRILL-${stamp()}`;
    const created = await prisma.riskCategory.create({
      data: { tenantId: acme.id, name: "Restore drill", code },
    });
    const snapshot = await logicalSnapshot(prisma);
    await prisma.riskCategory.delete({ where: { id: created.id } });
    const missing = await prisma.riskCategory.findUnique({ where: { id: created.id } });
    if (missing) {
      throw new Error("Restore drill could not delete the canary row.");
    }
    const dumped = snapshot.categories.find((row) => row.id === created.id);
    if (!dumped) {
      throw new Error("Restore drill snapshot did not contain the canary row.");
    }
    await prisma.riskCategory.create({
      data: { id: dumped.id, tenantId: dumped.tenantId, name: dumped.name, code: dumped.code },
    });
    const restored = await prisma.riskCategory.findUniqueOrThrow({ where: { id: created.id } });
    if (restored.code !== code) {
      throw new Error("Restore drill did not restore the canary row.");
    }
    await prisma.riskCategory.delete({ where: { id: created.id } });
    const dir = join(ROOT, ".local", "backups");
    await mkdir(dir, { recursive: true });
    const reportPath = join(dir, `restore-drill-${stamp()}.json`);
    await writeFile(
      reportPath,
      `${JSON.stringify({ ok: true, restoredId: created.id, tenants: snapshot.tenants.length, risks: snapshot.risks.length }, null, 2)}\n`,
      "utf8",
    );
    console.info(`Restore drill passed. Report: ${reportPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function tenantExport(rawSlug: string | undefined): Promise<void> {
  const slug = assertSlug(rawSlug);
  const prisma = createMigratorClient(ownerUrl());
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      throw new Error(`Tenant ${slug} was not found.`);
    }
    const [memberships, risks] = await Promise.all([
      prisma.membership.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, status: true, userId: true },
      }),
      prisma.risk.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, code: true, title: true, status: true },
      }),
    ]);
    const dir = join(ROOT, ".local", "exports");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${slug}-${stamp()}.json`);
    await writeFile(
      path,
      `${JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status, locale: tenant.locale },
          memberships,
          risks,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    console.info(`Exported ${slug} to ${path}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function tenantOffboard(rawSlug: string | undefined): Promise<void> {
  const slug = assertSlug(rawSlug);
  if (process.env.TENANT_OFFBOARD_CONFIRM !== slug) {
    throw new Error(`Refusing to offboard ${slug}. Set TENANT_OFFBOARD_CONFIRM=${slug} after exporting the tenant.`);
  }
  const prisma = createMigratorClient(ownerUrl());
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      throw new Error(`Tenant ${slug} was not found.`);
    }
    const memberships = await prisma.membership.updateMany({
      where: { tenantId: tenant.id },
      data: { status: "revoked" },
    });
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "offboarded" },
    });
    console.info(
      `Offboarded ${updated.slug}: status=${updated.status} revokedMemberships=${memberships.count}. Records are preserved.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function auditRetention(): Promise<void> {
  const days = Number(process.env.AUDIT_RETENTION_DAYS ?? 730);
  if (!Number.isFinite(days) || days < 30) {
    throw new Error("AUDIT_RETENTION_DAYS must be an integer >= 30.");
  }
  if (process.env.AUDIT_PURGE_CONFIRM !== "PURGE") {
    console.info("Dry run. App and worker roles cannot DELETE audit_events.");
    console.info(`Would purge rows older than ${Math.floor(days)} days using the owner DATABASE_URL.`);
    console.info("Set AUDIT_PURGE_CONFIRM=PURGE to execute the owner-role procedure.");
    return;
  }
  const prisma = createMigratorClient(ownerUrl());
  try {
    await prisma.$executeRawUnsafe("ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_update");
    const deleted = await prisma.auditEvent.deleteMany({
      where: { occurredAt: { lt: new Date(Date.now() - Math.floor(days) * 24 * 60 * 60 * 1000) } },
    });
    await prisma.$executeRawUnsafe("ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_update");
    const remaining = await prisma.auditEvent.count();
    console.info(`Audit retention purge complete: deleted=${deleted.count} remaining=${remaining}`);
  } catch (error) {
    await prisma.$executeRawUnsafe("ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_update").catch(() => undefined);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function logicalSnapshot(prisma: ReturnType<typeof createMigratorClient>) {
  const [tenants, risks, categories, memberships, auditEvents] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, slug: true, name: true, status: true } }),
    prisma.risk.findMany({ select: { id: true, tenantId: true, code: true, title: true, status: true } }),
    prisma.riskCategory.findMany({ select: { id: true, tenantId: true, name: true, code: true } }),
    prisma.membership.count(),
    prisma.auditEvent.count(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    tenants,
    risks,
    categories,
    memberships,
    auditEvents,
  };
}
