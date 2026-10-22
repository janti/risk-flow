"use client";

import { Button, ErrorState, PageHeader, PermissionGate, Skeleton, StatusBadge, useT } from "@riskflow/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useApiError } from "../../lib/use-api-error";
import { RiskFormRenderer } from "../forms/risk-form-renderer";
import { RiskActionList } from "./risk-action-list";
import { RiskAttachmentPanel } from "./risk-attachment-panel";
import { RiskAssessmentPanel } from "./risk-assessment-panel";
import { RiskForm } from "./risk-form";
import { RiskTreatmentPanel } from "./risk-treatment-panel";
import type { RiskPermissions, RiskRecord } from "./types";

type RiskDetailProps = {
  tenantSlug: string;
  riskId: string;
  membershipId: string;
  permissions: RiskPermissions;
};

export function RiskDetail({ tenantSlug, riskId, membershipId, permissions }: RiskDetailProps) {
  const t = useT();
  const apiError = useApiError();
  const router = useRouter();
  const [risk, setRisk] = useState<RiskRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    void apiRequest<{ risk: RiskRecord }>(`/api/v1/tenants/${tenantSlug}/risks/${riskId}`).then((result) => {
      if (!result.ok) {
        setError(apiError(result));
        return;
      }
      setRisk(result.data.risk);
    });
  }, [apiError, riskId, tenantSlug]);

  async function archive() {
    if (!risk) {
      return;
    }
    if (!window.confirm(t("risks.archiveConfirm", { code: risk.code }))) {
      return;
    }
    setArchiving(true);
    setMessage(null);
    const result = await apiRequest<{ risk: RiskRecord }>(
      `/api/v1/tenants/${tenantSlug}/risks/${risk.id}/archive`,
      {
        method: "POST",
        body: JSON.stringify({ version: risk.version }),
      },
    );
    setArchiving(false);
    if (!result.ok) {
      setMessage(apiError(result));
      return;
    }
    setRisk(result.data.risk);
    setEditing(false);
    router.refresh();
  }

  if (error) {
    return <ErrorState title={t("risks.notFound")} description={error} />;
  }
  if (!risk) {
    return (
      <div className="space-y-3" data-testid="risk-detail-loading">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (editing && permissions.update && !risk.archivedAt) {
    return (
      <RiskForm
        tenantSlug={tenantSlug}
        mode="edit"
        risk={risk}
        onSaved={(updated) => {
          setRisk(updated);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${risk.code} ${risk.title}`}
        description={risk.orgUnit.name}
        actions={
          <div className="flex gap-2">
            <PermissionGate allowed={permissions.update && !risk.archivedAt}>
              <Button type="button" variant="outline" onClick={() => setEditing(true)} data-testid="risk-edit">
                {t("common.edit")}
              </Button>
            </PermissionGate>
            <PermissionGate allowed={permissions.archive && !risk.archivedAt}>
              <Button
                type="button"
                variant="destructive"
                disabled={archiving}
                onClick={() => void archive()}
                data-testid="risk-archive"
              >
                {t("risks.archive")}
              </Button>
            </PermissionGate>
            <Button asChild variant="ghost">
              <Link href={`/t/${tenantSlug}/risks`}>{t("common.back")}</Link>
            </Button>
          </div>
        }
      />
      <dl className="grid gap-4 rounded-lg border bg-card p-6 sm:grid-cols-2" data-testid="risk-detail">
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted-foreground">{t("common.title")}</dt>
          <dd data-testid="risk-detail-title">{risk.title}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("risks.code")}</dt>
          <dd className="font-medium" data-testid="risk-code">
            {risk.code}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("common.status")}</dt>
          <dd>
            <StatusBadge status={risk.status} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("risks.category")}</dt>
          <dd>{risk.category.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("risks.orgUnit")}</dt>
          <dd>{risk.orgUnit.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("risks.owner")}</dt>
          <dd>{risk.owner.displayName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("common.version")}</dt>
          <dd data-testid="risk-version">{risk.version}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted-foreground">{t("common.description")}</dt>
          <dd>{risk.description || t("risks.noDescription")}</dd>
        </div>
        {risk.formVersion ? (
          <div className="sm:col-span-2 space-y-2">
            <dt className="text-sm text-muted-foreground">
              {t("risks.customFields", { version: risk.formVersion.version })}
            </dt>
            <dd>
              <RiskFormRenderer
                schema={risk.formVersion.schema}
                ui={risk.formVersion.ui}
                values={risk.customValues}
                readOnly
                testId="risk-custom-fields"
              />
            </dd>
          </div>
        ) : null}
      </dl>
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <RiskAssessmentPanel
        tenantSlug={tenantSlug}
        riskId={risk.id}
        categoryCode={risk.category.code}
        canAssess={permissions.assess}
      />
      <RiskTreatmentPanel
        tenantSlug={tenantSlug}
        riskId={risk.id}
        categoryCode={risk.category.code}
        canUpdate={permissions.update}
        canApprove={permissions.approve}
        membershipId={membershipId}
      />
      <RiskAttachmentPanel tenantSlug={tenantSlug} riskId={risk.id} canUpdate={permissions.update && !risk.archivedAt} />
      <RiskActionList
        tenantSlug={tenantSlug}
        riskId={risk.id}
        canAssign={permissions.assign}
        canComplete={permissions.complete}
      />
    </div>
  );
}
