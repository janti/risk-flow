"use client";

import { localeTag, type MessageKey } from "@riskflow/shared";
import { Button, EmptyState, ErrorState, PermissionGate, Skeleton, Spinner, StatusBadge, useLocale, useT } from "@riskflow/ui";
import type { ApprovalRecord, TenantPolicy, TreatmentRecord } from "@riskflow/risk-engine";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";
import { StandardGuidance } from "./standard-guidance";

type RiskTreatmentPanelProps = {
  tenantSlug: string;
  riskId: string;
  categoryCode: string;
  canUpdate: boolean;
  canApprove: boolean;
  membershipId: string;
};

const STRATEGIES = ["avoid", "reduce", "share", "accept"] as const;

export function RiskTreatmentPanel({
  tenantSlug,
  riskId,
  categoryCode,
  canUpdate,
  canApprove,
  membershipId,
}: RiskTreatmentPanelProps) {
  const t = useT();
  const locale = useLocale();
  const apiError = useApiError();
  const [treatment, setTreatment] = useState<TreatmentRecord | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [policy, setPolicy] = useState<TenantPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<"avoid" | "reduce" | "share" | "accept">("reduce");
  const [targetDate, setTargetDate] = useState("");
  const [acceptanceReason, setAcceptanceReason] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const result = await apiRequest<{
      treatment: TreatmentRecord | null;
      approvals: ApprovalRecord[];
      policy: TenantPolicy;
    }>(`/api/v1/tenants/${tenantSlug}/risks/${riskId}/treatments`);
    setLoading(false);
    if (!result.ok) {
      setError(apiError(result));
      return;
    }
    setTreatment(result.data.treatment);
    setApprovals(result.data.approvals);
    setPolicy(result.data.policy);
    if (result.data.treatment) {
      setStrategy(result.data.treatment.strategy);
      setTargetDate(result.data.treatment.targetDate ?? "");
      setAcceptanceReason(result.data.treatment.acceptanceReason ?? "");
    }
  }

  useEffect(() => {
    void load();
  }, [riskId, tenantSlug]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await apiRequest<{ treatment: TreatmentRecord }>(
      `/api/v1/tenants/${tenantSlug}/risks/${riskId}/treatments`,
      {
        method: "POST",
        body: JSON.stringify({
          strategy,
          targetDate: targetDate || undefined,
          acceptanceReason: strategy === "accept" ? acceptanceReason : undefined,
        }),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    await load();
  }

  async function decide(decision: "approve" | "reject") {
    setSaving(true);
    setMessage(null);
    const result = await apiRequest<{ treatment: TreatmentRecord; approval: ApprovalRecord }>(
      `/api/v1/tenants/${tenantSlug}/risks/${riskId}/approvals`,
      {
        method: "POST",
        body: JSON.stringify({ decision, comment }),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setComment("");
    await load();
  }

  if (error) {
    return <ErrorState title={t("treatments.loadError")} description={error} onRetry={() => void load()} />;
  }
  if (loading) {
    return (
      <div className="space-y-3">
        <Spinner label={t("common.loading")} className="justify-start" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const ownSubmission = treatment?.submittedBy.id === membershipId;
  const sodBlocks = Boolean(policy?.separationOfDuties && ownSubmission);
  const canDecide = canApprove && treatment?.status === "pending" && !sodBlocks;

  return (
    <section className="space-y-4" data-testid="risk-treatment-panel">
      <h2 className="text-lg font-semibold">{t("treatments.title")}</h2>
      <StandardGuidance categoryCode={categoryCode} surface="treat" strategy={strategy} />
      <PermissionGate allowed={canUpdate && treatment?.status !== "approved"}>
        <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="block text-sm">
            {t("treatments.strategy")}
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as typeof strategy)}
              data-testid="treatment-strategy"
            >
              {STRATEGIES.map((value) => (
                <option key={value} value={value}>
                  {t(`status.${value}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t("treatments.targetDate")}
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              data-testid="treatment-target-date"
            />
          </label>
          {strategy === "accept" ? (
            <label className="block text-sm md:col-span-2">
              {t("treatments.acceptanceReason")}
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2"
                required
                value={acceptanceReason}
                onChange={(event) => setAcceptanceReason(event.target.value)}
                placeholder={t("guidance.treatment.accept")}
                data-testid="treatment-acceptance-reason"
              />
            </label>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" loading={saving} data-testid="treatment-save">
              {t("treatments.submit")}
            </Button>
          </div>
        </form>
      </PermissionGate>
      {treatment ? (
        <div className="rounded-lg border bg-card p-4" data-testid="treatment-current">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={treatment.strategy} />
            <StatusBadge status={treatment.status} />
            <span className="text-sm text-muted-foreground">{t("treatments.stage", { stage: treatment.currentStage })}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("treatments.submittedBy", { name: treatment.submittedBy.displayName })}
            {treatment.targetDate ? ` · ${t("treatments.target", { date: treatment.targetDate })}` : ""}
          </p>
          {treatment.acceptanceReason ? <p className="mt-2 text-sm">{treatment.acceptanceReason}</p> : null}
        </div>
      ) : (
        <EmptyState title={t("treatments.emptyTitle")} description={t("treatments.emptyDescription")} />
      )}
      <div className="space-y-3" data-testid="approval-timeline">
        <h3 className="font-medium">{t("treatments.approvals")}</h3>
        {approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("treatments.noDecisions")}</p>
        ) : (
          <ol className="space-y-3">
            {approvals.map((approval) => (
              <li key={approval.id} className="rounded-lg border bg-card p-4" data-testid="approval-item">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={approval.decision === "approve" ? "approved" : "rejected"} />
                  <span className="text-sm">{approval.stage}</span>
                </div>
                <p className="mt-2 text-sm">{approval.comment}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {approval.approver.displayName} · {new Date(approval.decidedAt).toLocaleString(localeTag(locale))}
                </p>
              </li>
            ))}
          </ol>
        )}
        {sodBlocks && canApprove && treatment?.status === "pending" ? (
          <p className="text-sm text-muted-foreground" data-testid="approval-sod">
            {t("treatments.sod")}
          </p>
        ) : null}
        <PermissionGate allowed={canDecide}>
          <form
            className="space-y-3 rounded-lg border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void decide("approve");
            }}
          >
            <label className="block text-sm">
              {t("common.comment")}
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2"
                required
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                data-testid="approval-comment"
              />
            </label>
            {message ? (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" loading={saving} disabled={comment.trim().length === 0} data-testid="approval-approve">
                {t("treatments.approve")}
              </Button>
              <Button
                type="button"
                variant="outline"
                loading={saving}
                disabled={comment.trim().length === 0}
                onClick={() => void decide("reject")}
                data-testid="approval-reject"
              >
                {t("treatments.reject")}
              </Button>
            </div>
          </form>
        </PermissionGate>
      </div>
      {message && !canDecide ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
