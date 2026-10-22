-- Sprint 09: module catalog, platform entitlements, tenant module switches.

CREATE TABLE "module_catalog" (
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "dependencies_json" JSONB NOT NULL,
    CONSTRAINT "module_catalog_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "tenant_entitlements" (
    "tenant_id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "entitled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "tenant_entitlements_pkey" PRIMARY KEY ("tenant_id", "module_key")
);

CREATE INDEX "tenant_entitlements_tenant_idx" ON "tenant_entitlements"("tenant_id");

ALTER TABLE "tenant_entitlements"
    ADD CONSTRAINT "tenant_entitlements_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_entitlements"
    ADD CONSTRAINT "tenant_entitlements_module_key_fkey"
    FOREIGN KEY ("module_key") REFERENCES "module_catalog"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tenant_modules" (
    "tenant_id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "settings_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "tenant_modules_pkey" PRIMARY KEY ("tenant_id", "module_key")
);

CREATE INDEX "tenant_modules_tenant_idx" ON "tenant_modules"("tenant_id");

ALTER TABLE "tenant_modules"
    ADD CONSTRAINT "tenant_modules_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_modules"
    ADD CONSTRAINT "tenant_modules_module_key_fkey"
    FOREIGN KEY ("module_key") REFERENCES "module_catalog"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER tenant_modules_set_updated_at
BEFORE UPDATE ON "tenant_modules"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "tenant_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_entitlements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_modules" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenant_entitlements ON "tenant_entitlements"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_tenant_modules ON "tenant_modules"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT ON TABLE "module_catalog" TO riskflow_app, riskflow_worker;
GRANT SELECT ON TABLE "tenant_entitlements" TO riskflow_app, riskflow_worker;
GRANT SELECT, INSERT, UPDATE ON TABLE "tenant_modules" TO riskflow_app, riskflow_worker;
REVOKE INSERT, UPDATE, DELETE ON TABLE "module_catalog", "tenant_entitlements" FROM riskflow_app, riskflow_worker;
REVOKE DELETE ON TABLE "tenant_modules" FROM riskflow_app, riskflow_worker;

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_select ON "tenants"
    FOR SELECT TO riskflow_app, riskflow_worker
    USING (true);
CREATE POLICY tenants_update_self ON "tenants"
    FOR UPDATE TO riskflow_app, riskflow_worker
    USING (id = nullif(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (id = nullif(current_setting('app.tenant_id', true), '')::uuid);
GRANT UPDATE ON TABLE "tenants" TO riskflow_app, riskflow_worker;
