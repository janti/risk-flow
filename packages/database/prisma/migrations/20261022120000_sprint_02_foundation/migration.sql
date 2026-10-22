-- Sprint 02 foundation: tenant tables, composite FKs, FORCE RLS, runtime roles.
-- Local/dev role passwords below must be rotated before any non-dev environment.

CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "locale" TEXT NOT NULL DEFAULT 'fi',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Helsinki',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auth_subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_auth_subject_key" ON "users"("auth_subject");

CREATE TABLE "permissions" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "org_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "org_unit_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "org_unit_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_key" TEXT NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("tenant_id", "role_id", "permission_key")
);

CREATE TABLE "membership_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "org_unit_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "risk_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "risk_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "risks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "owner_membership_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "custom_values_json" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "before_json" JSONB,
    "after_json" JSONB,
    "request_id" TEXT,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- Unique keys used by composite FKs
CREATE UNIQUE INDEX "memberships_tenant_id_key" ON "memberships"("tenant_id", "id");
CREATE UNIQUE INDEX "memberships_tenant_user_key" ON "memberships"("tenant_id", "user_id");
CREATE UNIQUE INDEX "org_units_tenant_id_key" ON "org_units"("tenant_id", "id");
CREATE UNIQUE INDEX "org_unit_memberships_tenant_id_key" ON "org_unit_memberships"("tenant_id", "id");
CREATE UNIQUE INDEX "org_unit_memberships_unique" ON "org_unit_memberships"("tenant_id", "membership_id", "org_unit_id");
CREATE UNIQUE INDEX "roles_tenant_id_key" ON "roles"("tenant_id", "id");
CREATE UNIQUE INDEX "roles_tenant_key_key" ON "roles"("tenant_id", "key");
CREATE UNIQUE INDEX "membership_roles_tenant_id_key" ON "membership_roles"("tenant_id", "id");
CREATE UNIQUE INDEX "risk_categories_tenant_id_key" ON "risk_categories"("tenant_id", "id");
CREATE UNIQUE INDEX "risk_categories_tenant_code_key" ON "risk_categories"("tenant_id", "code");
CREATE UNIQUE INDEX "risks_tenant_id_key" ON "risks"("tenant_id", "id");
CREATE UNIQUE INDEX "risks_tenant_code_key" ON "risks"("tenant_id", "code");
CREATE UNIQUE INDEX "audit_events_tenant_id_key" ON "audit_events"("tenant_id", "id");

CREATE INDEX "memberships_tenant_idx" ON "memberships"("tenant_id");
CREATE INDEX "org_units_tenant_idx" ON "org_units"("tenant_id");
CREATE INDEX "org_unit_memberships_tenant_idx" ON "org_unit_memberships"("tenant_id");
CREATE INDEX "roles_tenant_idx" ON "roles"("tenant_id");
CREATE INDEX "role_permissions_tenant_idx" ON "role_permissions"("tenant_id");
CREATE INDEX "membership_roles_tenant_idx" ON "membership_roles"("tenant_id");
CREATE INDEX "risk_categories_tenant_idx" ON "risk_categories"("tenant_id");
CREATE INDEX "risks_tenant_status_idx" ON "risks"("tenant_id", "status");
CREATE INDEX "audit_events_tenant_occurred_idx" ON "audit_events"("tenant_id", "occurred_at");

-- Tenant-scoped composite foreign keys
ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_units"
    ADD CONSTRAINT "org_units_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_units"
    ADD CONSTRAINT "org_units_parent_fk"
    FOREIGN KEY ("tenant_id", "parent_id") REFERENCES "org_units"("tenant_id", "id")
    MATCH SIMPLE ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_unit_memberships"
    ADD CONSTRAINT "org_unit_memberships_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_unit_memberships"
    ADD CONSTRAINT "org_unit_memberships_membership_fk"
    FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_unit_memberships"
    ADD CONSTRAINT "org_unit_memberships_org_unit_fk"
    FOREIGN KEY ("tenant_id", "org_unit_id") REFERENCES "org_units"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "roles"
    ADD CONSTRAINT "roles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_role_fk"
    FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_permission_fkey"
    FOREIGN KEY ("permission_key") REFERENCES "permissions"("key")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "membership_roles"
    ADD CONSTRAINT "membership_roles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "membership_roles"
    ADD CONSTRAINT "membership_roles_membership_fk"
    FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "membership_roles"
    ADD CONSTRAINT "membership_roles_role_fk"
    FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "membership_roles"
    ADD CONSTRAINT "membership_roles_org_unit_fk"
    FOREIGN KEY ("tenant_id", "org_unit_id") REFERENCES "org_units"("tenant_id", "id")
    MATCH SIMPLE ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risk_categories"
    ADD CONSTRAINT "risk_categories_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risk_categories"
    ADD CONSTRAINT "risk_categories_parent_fk"
    FOREIGN KEY ("tenant_id", "parent_id") REFERENCES "risk_categories"("tenant_id", "id")
    MATCH SIMPLE ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risks"
    ADD CONSTRAINT "risks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risks"
    ADD CONSTRAINT "risks_category_fk"
    FOREIGN KEY ("tenant_id", "category_id") REFERENCES "risk_categories"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risks"
    ADD CONSTRAINT "risks_org_unit_fk"
    FOREIGN KEY ("tenant_id", "org_unit_id") REFERENCES "org_units"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risks"
    ADD CONSTRAINT "risks_owner_fk"
    FOREIGN KEY ("tenant_id", "owner_membership_id") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_events"
    ADD CONSTRAINT "audit_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_events"
    ADD CONSTRAINT "audit_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER memberships_set_updated_at BEFORE UPDATE ON "memberships" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER org_units_set_updated_at BEFORE UPDATE ON "org_units" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER org_unit_memberships_set_updated_at BEFORE UPDATE ON "org_unit_memberships" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER roles_set_updated_at BEFORE UPDATE ON "roles" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER membership_roles_set_updated_at BEFORE UPDATE ON "membership_roles" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER risk_categories_set_updated_at BEFORE UPDATE ON "risk_categories" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER risks_set_updated_at BEFORE UPDATE ON "risks" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tenants_set_updated_at BEFORE UPDATE ON "tenants" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION prevent_org_unit_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    current_id UUID;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'org unit cycle detected';
    END IF;
    current_id := NEW.parent_id;
    WHILE current_id IS NOT NULL LOOP
        IF current_id = NEW.id THEN
            RAISE EXCEPTION 'org unit cycle detected';
        END IF;
        SELECT parent_id INTO current_id
        FROM org_units
        WHERE id = current_id AND tenant_id = NEW.tenant_id;
    END LOOP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER org_units_prevent_cycle
BEFORE INSERT OR UPDATE OF parent_id, id, tenant_id
ON "org_units"
FOR EACH ROW EXECUTE FUNCTION prevent_org_unit_cycle();

CREATE OR REPLACE FUNCTION reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

-- Row Level Security
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
ALTER TABLE "org_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_units" FORCE ROW LEVEL SECURITY;
ALTER TABLE "org_unit_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_unit_memberships" FORCE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "risk_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risk_categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "risks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risks" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_memberships ON "memberships"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_org_units ON "org_units"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_org_unit_memberships ON "org_unit_memberships"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_roles ON "roles"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_role_permissions ON "role_permissions"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_membership_roles ON "membership_roles"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_risk_categories ON "risk_categories"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_risks ON "risks"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_audit_events ON "audit_events"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'riskflow_app') THEN
        CREATE ROLE riskflow_app LOGIN PASSWORD 'riskflow_app_dev_only'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'riskflow_worker') THEN
        CREATE ROLE riskflow_worker LOGIN PASSWORD 'riskflow_worker_dev_only'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
    END IF;
END
$$;

DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO riskflow_app', current_database());
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO riskflow_worker', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO riskflow_app, riskflow_worker;

GRANT SELECT ON TABLE "tenants", "users", "permissions" TO riskflow_app, riskflow_worker;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    "memberships",
    "org_units",
    "org_unit_memberships",
    "roles",
    "role_permissions",
    "membership_roles",
    "risk_categories",
    "risks"
TO riskflow_app, riskflow_worker;

GRANT SELECT, INSERT ON TABLE "audit_events" TO riskflow_app, riskflow_worker;

REVOKE UPDATE, DELETE ON TABLE "audit_events" FROM riskflow_app, riskflow_worker;
REVOKE INSERT, UPDATE, DELETE ON TABLE "tenants", "users", "permissions" FROM riskflow_app, riskflow_worker;

GRANT EXECUTE ON FUNCTION set_updated_at() TO riskflow_app, riskflow_worker;
GRANT EXECUTE ON FUNCTION prevent_org_unit_cycle() TO riskflow_app, riskflow_worker;
GRANT EXECUTE ON FUNCTION reject_audit_mutation() TO riskflow_app, riskflow_worker;
