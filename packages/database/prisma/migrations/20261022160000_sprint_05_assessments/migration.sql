-- Sprint 05: versioned scoring models and append-only assessments.

CREATE TABLE "scoring_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition_json" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "scoring_models_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "scoring_models_version_positive" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "scoring_models_tenant_key_version_key" ON "scoring_models"("tenant_id", "key", "version");
CREATE UNIQUE INDEX "scoring_models_tenant_id_key" ON "scoring_models"("tenant_id", "id");
CREATE INDEX "scoring_models_tenant_idx" ON "scoring_models"("tenant_id");

ALTER TABLE "scoring_models"
    ADD CONSTRAINT "scoring_models_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "risk_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "assessment_type" TEXT NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "rating" TEXT NOT NULL,
    "scoring_version_id" UUID NOT NULL,
    "rationale" TEXT NOT NULL,
    "assessed_by" UUID NOT NULL,
    "assessed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "risk_assessments_type_check" CHECK ("assessment_type" IN ('inherent', 'residual')),
    CONSTRAINT "risk_assessments_likelihood_check" CHECK ("likelihood" >= 1),
    CONSTRAINT "risk_assessments_impact_check" CHECK ("impact" >= 1),
    CONSTRAINT "risk_assessments_score_check" CHECK ("score" >= 1),
    CONSTRAINT "risk_assessments_rating_check" CHECK ("rating" IN ('low', 'medium', 'high', 'critical'))
);

CREATE UNIQUE INDEX "risk_assessments_tenant_id_key" ON "risk_assessments"("tenant_id", "id");
CREATE INDEX "risk_assessments_risk_assessed_idx" ON "risk_assessments"("tenant_id", "risk_id", "assessed_at");

ALTER TABLE "risk_assessments"
    ADD CONSTRAINT "risk_assessments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risk_assessments"
    ADD CONSTRAINT "risk_assessments_risk_fk"
    FOREIGN KEY ("tenant_id", "risk_id") REFERENCES "risks"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risk_assessments"
    ADD CONSTRAINT "risk_assessments_scoring_fk"
    FOREIGN KEY ("tenant_id", "scoring_version_id") REFERENCES "scoring_models"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "risk_assessments"
    ADD CONSTRAINT "risk_assessments_assessor_fk"
    FOREIGN KEY ("tenant_id", "assessed_by") REFERENCES "memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER scoring_models_set_updated_at
BEFORE UPDATE ON "scoring_models"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER scoring_models_immutable
BEFORE UPDATE OR DELETE ON "scoring_models"
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

CREATE TRIGGER risk_assessments_immutable
BEFORE UPDATE OR DELETE ON "risk_assessments"
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

ALTER TABLE "scoring_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scoring_models" FORCE ROW LEVEL SECURITY;
ALTER TABLE "risk_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risk_assessments" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_scoring_models ON "scoring_models"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_risk_assessments ON "risk_assessments"
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON TABLE "scoring_models", "risk_assessments" TO riskflow_app, riskflow_worker;
REVOKE UPDATE, DELETE ON TABLE "scoring_models", "risk_assessments" FROM riskflow_app, riskflow_worker;
