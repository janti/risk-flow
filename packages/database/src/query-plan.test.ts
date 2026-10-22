import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratorClient } from "./tenant-database";
import { startTestDatabase, type TestDatabase } from "./test-postgres";

describe("sprint 11 query plans", () => {
  let db: TestDatabase;
  let tenantId: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    const migrator = createMigratorClient(db.ownerUrl);
    try {
      const acme = await migrator.tenant.findUniqueOrThrow({ where: { slug: "acme" } });
      tenantId = acme.id;
      const sample = await migrator.risk.findFirstOrThrow({ where: { tenantId } });
      const extras = Array.from({ length: 2000 }, (_, index) => ({
        tenantId,
        code: `P-${String(index + 1).padStart(4, "0")}`,
        title:
          index % 100 === 0
            ? `Performance sample ${index + 1} trgmneedle supplier`
            : `Performance sample ${index + 1}`,
        categoryId: sample.categoryId,
        orgUnitId: sample.orgUnitId,
        ownerMembershipId: sample.ownerMembershipId,
        status: index % 5 === 0 ? "in_progress" : "open",
      }));
      await migrator.risk.createMany({ data: extras });
      await migrator.$executeRawUnsafe("ANALYZE risks");
    } finally {
      await migrator.$disconnect();
    }
  }, 300_000);

  afterAll(async () => {
    await db?.stop();
  });

  it("uses created_at and trgm indexes for list and search", async () => {
    const indexes = await db.app.withTenant(tenantId, (tx) =>
      tx.$queryRawUnsafe<Array<{ indexname: string }>>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'risks' AND indexname IN ('risks_tenant_created_idx', 'risks_title_trgm_idx', 'risks_code_trgm_idx')`,
      ),
    );
    expect(indexes.map((row) => row.indexname).sort()).toEqual([
      "risks_code_trgm_idx",
      "risks_tenant_created_idx",
      "risks_title_trgm_idx",
    ]);

    const listPlan = await db.app.withTenant(tenantId, (tx) =>
      tx.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
        `EXPLAIN SELECT id FROM risks WHERE tenant_id = $1::uuid AND status <> 'archived' ORDER BY created_at DESC, id DESC LIMIT 26`,
        tenantId,
      ),
    );
    const listText = listPlan.map((row) => row["QUERY PLAN"]).join("\n");
    expect(listText).toMatch(/Index Scan|Bitmap Index Scan|Index Only Scan/i);
    expect(listText.toLowerCase()).toContain("risks_tenant_created_idx");

    const listStarted = performance.now();
    await db.app.withTenant(tenantId, (tx) =>
      tx.$queryRawUnsafe(
        `SELECT id FROM risks WHERE tenant_id = $1::uuid AND status <> 'archived' ORDER BY created_at DESC, id DESC LIMIT 26`,
        tenantId,
      ),
    );
    expect(performance.now() - listStarted).toBeLessThan(200);

    const searchStarted = performance.now();
    await db.app.withTenant(tenantId, (tx) =>
      tx.$queryRawUnsafe(
        `SELECT id FROM risks WHERE tenant_id = $1::uuid AND title ILIKE $2 LIMIT 26`,
        tenantId,
        "%trgmneedle%",
      ),
    );
    expect(performance.now() - searchStarted).toBeLessThan(200);
  });
});
