-- Composite GIN so ILIKE search stays tenant-scoped instead of scanning a tenant btree.

CREATE EXTENSION IF NOT EXISTS btree_gin;

DROP INDEX IF EXISTS "risks_title_trgm_idx";
DROP INDEX IF EXISTS "risks_code_trgm_idx";

CREATE INDEX "risks_title_trgm_idx"
  ON "risks" USING gin ("tenant_id", "title" gin_trgm_ops);

CREATE INDEX "risks_code_trgm_idx"
  ON "risks" USING gin ("tenant_id", "code" gin_trgm_ops);
