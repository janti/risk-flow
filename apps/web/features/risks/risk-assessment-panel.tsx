"use client";

import { localeTag } from "@riskflow/shared";
import { Button, EmptyState, ErrorState, PermissionGate, Skeleton, Spinner, StatusBadge, useLocale, useT } from "@riskflow/ui";
import { impactScaleKey, likelihoodScaleKey } from "@riskflow/risk-engine/guidance";
import type { AssessmentSummary, ScoringModelRecord } from "@riskflow/risk-engine";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";
import { StandardGuidance } from "./standard-guidance";

type RiskAssessmentPanelProps = {
  tenantSlug: string;
  riskId: string;
  categoryCode: string;
  canAssess: boolean;
};

export function RiskAssessmentPanel({ tenantSlug, riskId, categoryCode, canAssess }: RiskAssessmentPanelProps) {
  const t = useT();
  const locale = useLocale();
  const apiError = useApiError();
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [models, setModels] = useState<ScoringModelRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assessmentType, setAssessmentType] = useState<"inherent" | "residual">("inherent");
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [rationale, setRationale] = useState("");
  const [scoringVersionId, setScoringVersionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const result = await apiRequest<{ assessments: AssessmentSummary[]; scoringModels: ScoringModelRecord[] }>(
      `/api/v1/tenants/${tenantSlug}/risks/${riskId}/assessments`,
    );
    setLoading(false);
    if (!result.ok) {
      setError(apiError(result));
      return;
    }
    setAssessments(result.data.assessments);
    setModels(result.data.scoringModels);
    setScoringVersionId((current) => current || result.data.scoringModels[0]?.id || "");
  }

  useEffect(() => {
    void load();
  }, [riskId, tenantSlug]);

  const model = models.find((item) => item.id === scoringVersionId) ?? models[0];
  const size = model?.grid === "3x3" ? 3 : 5;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!model) {
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await apiRequest<{ assessment: AssessmentSummary }>(
      `/api/v1/tenants/${tenantSlug}/risks/${riskId}/assessments`,
      {
        method: "POST",
        body: JSON.stringify({
          assessmentType,
          likelihood,
          impact,
          rationale,
          scoringVersionId: model.id,
        }),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setRationale("");
    await load();
  }

  if (error) {
    return <ErrorState title={t("assessments.loadError")} description={error} onRetry={() => void load()} />;
  }
  if (loading) {
    return (
      <div className="space-y-3">
        <Spinner label={t("common.loading")} className="justify-start" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="risk-assessment-panel">
      <h2 className="text-lg font-semibold">{t("assessments.title")}</h2>
      <StandardGuidance categoryCode={categoryCode} surface="assess" />
      <PermissionGate allowed={canAssess}>
        <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="block text-sm">
            {t("risks.type")}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={assessmentType}
              onChange={(event) => setAssessmentType(event.target.value as "inherent" | "residual")}
              data-testid="assessment-type"
            >
              <option value="inherent">{t("risks.inherent")}</option>
              <option value="residual">{t("risks.residual")}</option>
            </select>
          </label>
          <label className="block text-sm">
            {t("assessments.model")}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={model?.id ?? ""}
              onChange={(event) => setScoringVersionId(event.target.value)}
            >
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.key} v{item.version} ({item.grid})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t("assessments.likelihood")}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={likelihood}
              onChange={(event) => setLikelihood(Number(event.target.value))}
              data-testid="assessment-likelihood"
            >
              {Array.from({ length: size }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {t(likelihoodScaleKey(size, value))}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t("assessments.impact")}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={impact}
              onChange={(event) => setImpact(Number(event.target.value))}
              data-testid="assessment-impact"
            >
              {Array.from({ length: size }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {t(impactScaleKey(size, value))}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            {t("assessments.rationale")}
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2"
              required
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder={t("guidance.assess.rationaleHint")}
              data-testid="assessment-rationale"
            />
          </label>
          {message ? (
            <p className="text-sm text-destructive md:col-span-2" role="alert">
              {message}
            </p>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" loading={saving} disabled={!model} data-testid="assessment-save">
              {t("assessments.save")}
            </Button>
          </div>
        </form>
      </PermissionGate>
      {assessments.length === 0 ? (
        <EmptyState title={t("assessments.emptyTitle")} description={t("assessments.emptyDescription")} />
      ) : (
        <ol className="space-y-3">
          {assessments.map((assessment) => (
            <li key={assessment.id} className="rounded-lg border bg-card p-4" data-testid="assessment-item">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{assessment.assessmentType === "residual" ? t("risks.residual") : t("risks.inherent")}</strong>
                <StatusBadge status={assessment.rating} />
                <span className="text-sm text-muted-foreground">
                  {assessment.likelihood} × {assessment.impact} = {assessment.score}
                </span>
                <span className="text-sm text-muted-foreground">
                  {assessment.scoringModelKey} v{assessment.scoringModelVersion}
                </span>
              </div>
              <p className="mt-2 text-sm">{assessment.rationale}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {assessment.assessedBy.displayName} · {new Date(assessment.assessedAt).toLocaleString(localeTag(locale))}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
