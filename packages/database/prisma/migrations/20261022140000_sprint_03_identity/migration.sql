-- Sprint 03 identity: platform admins, invitations, own-membership SELECT.

ALTER TABLE "users"
    ADD COLUMN "platform_admin" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role_key" TEXT NOT NULL,
    "org_unit_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "invited_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");
CREATE UNIQUE INDEX "invitations_tenant_id_key" ON "invitations"("tenant_id", "id");
CREATE INDEX "invitations_tenant_idx" ON "invitations"("tenant_id");
CREATE UNIQUE INDEX "invitations_pending_email_key"
    ON "invitations"("tenant_id", lower("email"))
    WHERE "accepted_at" IS NULL;

ALTER TABLE "invitations"
    ADD CONSTRAINT "invitations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invitations"
    ADD CONSTRAINT "invitations_inviter_fk"
    FOREIGN KEY ("tenant_id", "invited_by_membership_id") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invitations"
    ADD CONSTRAINT "invitations_org_unit_fk"
    FOREIGN KEY ("tenant_id", "org_unit_id") REFERENCES "org_units"("tenant_id", "id")
    MATCH SIMPLE ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invitations ON "invitations"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Token redemption looks up an invite before tenant context is known.
CREATE POLICY invitations_by_token ON "invitations"
FOR SELECT
USING (token_hash = nullif(current_setting('app.invite_token_hash', true), ''));

-- SELECT-only: a user may list their own memberships across tenants for /me.
-- INSERT/UPDATE/DELETE still require the tenant policy (no self-join).
CREATE POLICY memberships_own_user ON "memberships"
FOR SELECT
USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON TABLE "invitations" TO riskflow_app, riskflow_worker;
GRANT INSERT, UPDATE ON TABLE "users" TO riskflow_app, riskflow_worker;
