-- Sprint 08: form definitions, versioned schemas, bind risks.form_version_id.

CREATE TABLE "form_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_entity" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "form_definitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "form_definitions_target_entity_check" CHECK ("target_entity" IN ('risk'))
);

CREATE UNIQUE INDEX "form_definitions_tenant_key_key" ON "form_definitions"("tenant_id", "key");
CREATE UNIQUE INDEX "form_definitions_tenant_id_key" ON "form_definitions"("tenant_id", "id");
CREATE INDEX "form_definitions_tenant_idx" ON "form_definitions"("tenant_id");

ALTER TABLE "form_definitions"
    ADD CONSTRAINT "form_definitions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "form_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "schema_json" JSONB NOT NULL,
    "ui_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "form_versions_status_check" CHECK ("status" IN ('draft', 'published')),
    CONSTRAINT "form_versions_published_at_check" CHECK (
        ("status" = 'published' AND "published_at" IS NOT NULL)
        OR ("status" = 'draft' AND "published_at" IS NULL)
    )
);

CREATE UNIQUE INDEX "form_versions_tenant_definition_version_key"
    ON "form_versions"("tenant_id", "definition_id", "version");
CREATE UNIQUE INDEX "form_versions_tenant_id_key" ON "form_versions"("tenant_id", "id");
CREATE INDEX "form_versions_tenant_definition_status_idx"
    ON "form_versions"("tenant_id", "definition_id", "status");

ALTER TABLE "form_versions"
    ADD CONSTRAINT "form_versions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "form_versions"
    ADD CONSTRAINT "form_versions_definition_fk"
    FOREIGN KEY ("tenant_id", "definition_id") REFERENCES "form_definitions"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risks"
    ADD COLUMN "form_version_id" UUID;

ALTER TABLE "risks"
    ADD CONSTRAINT "risks_form_version_fk"
    FOREIGN KEY ("tenant_id", "form_version_id") REFERENCES "form_versions"("tenant_id", "id")
    MATCH SIMPLE ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_published_form_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'form versions cannot be deleted';
  END IF;
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'published form versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER form_definitions_set_updated_at
BEFORE UPDATE ON "form_definitions"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER form_versions_set_updated_at
BEFORE UPDATE ON "form_versions"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER form_versions_published_immutable
BEFORE UPDATE OR DELETE ON "form_versions"
FOR EACH ROW EXECUTE FUNCTION reject_published_form_version_mutation();

ALTER TABLE "form_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_definitions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "form_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_versions" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_form_definitions ON "form_definitions"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_form_versions ON "form_versions"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON TABLE "form_definitions", "form_versions" TO riskflow_app, riskflow_worker;
REVOKE DELETE ON TABLE "form_definitions", "form_versions" FROM riskflow_app, riskflow_worker;
GRANT EXECUTE ON FUNCTION reject_published_form_version_mutation() TO riskflow_app, riskflow_worker;
