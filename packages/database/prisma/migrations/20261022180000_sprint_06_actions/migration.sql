-- Sprint 06: treatments, actions, approvals, transactional outbox, tenant policy.

ALTER TABLE "tenants"
    ADD COLUMN "settings_json" JSONB NOT NULL DEFAULT '{"separationOfDuties":true,"approvalStages":["treatment"]}';

CREATE TABLE "risk_treatments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "strategy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "current_stage" TEXT NOT NULL DEFAULT 'treatment',
    "target_date" DATE,
    "acceptance_reason" TEXT,
    "submitted_by" UUID NOT NULL,
    "approved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "risk_treatments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "risk_treatments_strategy_check" CHECK ("strategy" IN ('avoid', 'reduce', 'share', 'accept')),
    CONSTRAINT "risk_treatments_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected'))
);

CREATE UNIQUE INDEX "risk_treatments_tenant_risk_key" ON "risk_treatments"("tenant_id", "risk_id");
CREATE UNIQUE INDEX "risk_treatments_tenant_id_key" ON "risk_treatments"("tenant_id", "id");
CREATE INDEX "risk_treatments_tenant_idx" ON "risk_treatments"("tenant_id");

ALTER TABLE "risk_treatments"
    ADD CONSTRAINT "risk_treatments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risk_treatments"
    ADD CONSTRAINT "risk_treatments_risk_fk"
    FOREIGN KEY ("tenant_id", "risk_id") REFERENCES "risks"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risk_treatments"
    ADD CONSTRAINT "risk_treatments_submitter_fk"
    FOREIGN KEY ("tenant_id", "submitted_by") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risk_treatments"
    ADD CONSTRAINT "risk_treatments_approver_fk"
    FOREIGN KEY ("tenant_id", "approved_by") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee_membership_id" UUID NOT NULL,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "actions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "actions_status_check" CHECK ("status" IN ('open', 'in_progress', 'completed')),
    CONSTRAINT "actions_completed_at_check" CHECK (
        ("status" = 'completed' AND "completed_at" IS NOT NULL)
        OR ("status" <> 'completed' AND "completed_at" IS NULL)
    )
);

CREATE UNIQUE INDEX "actions_tenant_id_key" ON "actions"("tenant_id", "id");
CREATE INDEX "actions_tenant_status_due_idx" ON "actions"("tenant_id", "status", "due_at");

ALTER TABLE "actions"
    ADD CONSTRAINT "actions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "actions"
    ADD CONSTRAINT "actions_risk_fk"
    FOREIGN KEY ("tenant_id", "risk_id") REFERENCES "risks"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "actions"
    ADD CONSTRAINT "actions_assignee_fk"
    FOREIGN KEY ("tenant_id", "assignee_membership_id") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "approver_membership_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "comment" TEXT NOT NULL,
    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approvals_decision_check" CHECK ("decision" IN ('approve', 'reject'))
);

CREATE UNIQUE INDEX "approvals_tenant_id_key" ON "approvals"("tenant_id", "id");
CREATE INDEX "approvals_entity_idx" ON "approvals"("tenant_id", "entity_type", "entity_id");

ALTER TABLE "approvals"
    ADD CONSTRAINT "approvals_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approvals"
    ADD CONSTRAINT "approvals_actor_fk"
    FOREIGN KEY ("tenant_id", "approver_membership_id") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_tenant_id_key" ON "outbox_events"("tenant_id", "id");
CREATE INDEX "outbox_events_tenant_processed_idx" ON "outbox_events"("tenant_id", "processed_at");

ALTER TABLE "outbox_events"
    ADD CONSTRAINT "outbox_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER risk_treatments_set_updated_at
BEFORE UPDATE ON "risk_treatments"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER actions_set_updated_at
BEFORE UPDATE ON "actions"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER approvals_immutable
BEFORE UPDATE OR DELETE ON "approvals"
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

ALTER TABLE "risk_treatments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risk_treatments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "actions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approvals" FORCE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_risk_treatments ON "risk_treatments"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_actions ON "actions"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_approvals ON "approvals"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_outbox_events ON "outbox_events"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON TABLE "risk_treatments", "actions", "outbox_events" TO riskflow_app, riskflow_worker;
GRANT SELECT, INSERT ON TABLE "approvals" TO riskflow_app, riskflow_worker;
REVOKE DELETE ON TABLE "risk_treatments", "actions", "outbox_events" FROM riskflow_app, riskflow_worker;
REVOKE UPDATE, DELETE ON TABLE "approvals" FROM riskflow_app, riskflow_worker;
