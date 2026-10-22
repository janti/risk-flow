-- Sprint 11: list/filter/search indexes and pg_trgm for ILIKE risk search.

CREATE INDEX IF NOT EXISTS "risks_tenant_created_idx"
  ON "risks" ("tenant_id", "created_at", "id");

CREATE INDEX IF NOT EXISTS "risks_tenant_org_unit_idx"
  ON "risks" ("tenant_id", "org_unit_id");

CREATE INDEX IF NOT EXISTS "risks_tenant_owner_idx"
  ON "risks" ("tenant_id", "owner_membership_id");

CREATE INDEX IF NOT EXISTS "risks_tenant_category_idx"
  ON "risks" ("tenant_id", "category_id");

CREATE INDEX IF NOT EXISTS "risk_assessments_type_assessed_idx"
  ON "risk_assessments" ("tenant_id", "assessment_type", "assessed_at");

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "risks_title_trgm_idx"
  ON "risks" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "risks_code_trgm_idx"
  ON "risks" USING gin ("code" gin_trgm_ops);
