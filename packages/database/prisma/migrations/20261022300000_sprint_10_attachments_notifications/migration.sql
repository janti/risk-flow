-- Sprint 10: private attachments, in-app notifications, worker outbox poll.

CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "scan_status" TEXT NOT NULL DEFAULT 'pending',
    "uploaded_at" TIMESTAMPTZ(6),
    "uploaded_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attachments_entity_type_check" CHECK ("entity_type" IN ('risk')),
    CONSTRAINT "attachments_scan_status_check" CHECK ("scan_status" IN ('pending', 'clean', 'infected', 'skipped')),
    CONSTRAINT "attachments_size_check" CHECK ("size" >= 0 AND "size" <= 10485760)
);

CREATE UNIQUE INDEX "attachments_tenant_id_key" ON "attachments"("tenant_id", "id");
CREATE UNIQUE INDEX "attachments_tenant_object_key" ON "attachments"("tenant_id", "object_key");
CREATE INDEX "attachments_entity_idx" ON "attachments"("tenant_id", "entity_type", "entity_id");

ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_uploader_fk"
    FOREIGN KEY ("tenant_id", "uploaded_by_membership_id") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_tenant_id_key" ON "notifications"("tenant_id", "id");
CREATE UNIQUE INDEX "notifications_dedupe_key" ON "notifications"("tenant_id", "membership_id", "dedupe_key");
CREATE INDEX "notifications_inbox_idx" ON "notifications"("tenant_id", "membership_id", "created_at");

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_membership_fk"
    FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER attachments_set_updated_at
BEFORE UPDATE ON "attachments"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_attachments ON "attachments"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_notifications ON "notifications"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY worker_poll_outbox ON "outbox_events"
    FOR SELECT
    TO riskflow_worker
    USING (
        current_setting('app.worker_poll', true) = 'true'
        AND processed_at IS NULL
    );

CREATE POLICY worker_poll_overdue_actions ON "actions"
    FOR SELECT
    TO riskflow_worker
    USING (
        current_setting('app.worker_poll', true) = 'true'
        AND status <> 'completed'
        AND due_at < now()
    );

GRANT SELECT, INSERT, UPDATE ON TABLE "attachments", "notifications" TO riskflow_app, riskflow_worker;
REVOKE DELETE ON TABLE "attachments", "notifications" FROM riskflow_app, riskflow_worker;
