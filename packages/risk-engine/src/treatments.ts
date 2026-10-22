import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { Prisma, TenantDatabase, TenantTransaction } from "@riskflow/database";
import { z } from "zod";
import { writeAudit, writeOutbox } from "./outbox";
import {
  applyApprovalDecision,
  parseTenantPolicy,
  TREATMENT_STRATEGIES,
  type TenantPolicy,
  type TreatmentStatus,
  type TreatmentStrategy,
} from "./policy";
import { inOrgUnitScope } from "./scope";

export type TreatmentError = "forbidden" | "not_found" | "invalid" | "conflict" | "module_disabled";

export type TreatmentRecord = {
  id: string;
  riskId: string;
  strategy: TreatmentStrategy;
  status: TreatmentStatus;
  currentStage: string;
  targetDate: string | null;
  acceptanceReason: string | null;
  submittedBy: { id: string; displayName: string };
  approvedBy: { id: string; displayName: string } | null;
  updatedAt: string;
};

export type ApprovalRecord = {
  id: string;
  entityType: string;
  entityId: string;
  stage: string;
  decision: "approve" | "reject";
  comment: string;
  decidedAt: string;
  approver: { id: string; displayName: string };
};

export type TreatmentBundle = {
  treatment: TreatmentRecord | null;
  approvals: ApprovalRecord[];
  policy: TenantPolicy;
};

export const submitTreatmentSchema = z
  .object({
    strategy: z.enum(TREATMENT_STRATEGIES),
    targetDate: z.string().date().optional(),
    acceptanceReason: z.string().trim().max(4000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.strategy === "accept" && !value.acceptanceReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Acceptance requires a reason",
        path: ["acceptanceReason"],
      });
    }
  });

export const decideApprovalSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().trim().min(1).max(4000),
  stage: z.string().trim().min(1).max(80).optional(),
});

export type SubmitTreatmentInput = z.infer<typeof submitTreatmentSchema>;
export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;

const treatmentInclude = {
  submittedBy: { include: { user: true } },
  approvedBy: { include: { user: true } },
} as const;

const approvalInclude = {
  approver: { include: { user: true } },
} as const;

type TreatmentRow = Prisma.RiskTreatmentGetPayload<{ include: typeof treatmentInclude }>;
type ApprovalRow = Prisma.ApprovalGetPayload<{ include: typeof approvalInclude }>;

function mapPerson(row: { id: string; user: { displayName: string } } | null): { id: string; displayName: string } | null {
  if (!row) {
    return null;
  }
  return { id: row.id, displayName: row.user.displayName };
}

function mapTreatment(row: TreatmentRow): TreatmentRecord {
  return {
    id: row.id,
    riskId: row.riskId,
    strategy: row.strategy as TreatmentStrategy,
    status: row.status as TreatmentStatus,
    currentStage: row.currentStage,
    targetDate: row.targetDate ? row.targetDate.toISOString().slice(0, 10) : null,
    acceptanceReason: row.acceptanceReason,
    submittedBy: mapPerson(row.submittedBy)!,
    approvedBy: mapPerson(row.approvedBy),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapApproval(row: ApprovalRow): ApprovalRecord {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    stage: row.stage,
    decision: row.decision as "approve" | "reject",
    comment: row.comment,
    decidedAt: row.decidedAt.toISOString(),
    approver: mapPerson(row.approver)!,
  };
}

async function loadVisibleRisk(tx: TenantTransaction, access: TenantAccess, riskId: string) {
  const risk = await tx.risk.findFirst({ where: { id: riskId } });
  if (!risk || !inOrgUnitScope(access, risk.orgUnitId)) {
    return null;
  }
  return risk;
}

export async function getTreatmentBundle(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
): Promise<TreatmentBundle | TreatmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const risk = await loadVisibleRisk(tx, access, riskId);
    if (!risk) {
      return "not_found";
    }
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: access.tenant.id } });
    const policy = parseTenantPolicy(tenant.settingsJson);
    const treatment = await tx.riskTreatment.findFirst({
      where: { riskId },
      include: treatmentInclude,
    });
    const approvals = treatment
      ? await tx.approval.findMany({
          where: { entityType: "risk_treatment", entityId: treatment.id },
          include: approvalInclude,
          orderBy: { decidedAt: "asc" },
        })
      : [];
    return {
      treatment: treatment ? mapTreatment(treatment) : null,
      approvals: approvals.map(mapApproval),
      policy,
    };
  });
}

export async function submitTreatment(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
  input: SubmitTreatmentInput,
  requestId?: string,
): Promise<TreatmentRecord | TreatmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:update")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const risk = await loadVisibleRisk(tx, access, riskId);
    if (!risk) {
      return "not_found";
    }
    if (!authorize(access, "risk:update", { orgUnitId: risk.orgUnitId })) {
      return "forbidden";
    }
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: access.tenant.id } });
    const policy = parseTenantPolicy(tenant.settingsJson);
    const existing = await tx.riskTreatment.findFirst({ where: { riskId }, include: treatmentInclude });
    if (existing?.status === "approved") {
      return "conflict";
    }
    const data = {
      strategy: input.strategy,
      status: "pending" as const,
      currentStage: policy.approvalStages[0] ?? "treatment",
      targetDate: input.targetDate ? new Date(`${input.targetDate}T00:00:00.000Z`) : null,
      acceptanceReason: input.strategy === "accept" ? input.acceptanceReason ?? null : null,
      submittedById: access.membership.id,
      approvedById: null,
      updatedBy: access.user.id,
    };
    const saved = existing
      ? await tx.riskTreatment.update({
          where: { id: existing.id },
          data,
          include: treatmentInclude,
        })
      : await tx.riskTreatment.create({
          data: {
            tenantId: access.tenant.id,
            riskId,
            createdBy: access.user.id,
            ...data,
          },
          include: treatmentInclude,
        });
    if (risk.status === "open") {
      await tx.risk.update({
        where: { id: risk.id },
        data: { status: "in_progress", version: { increment: 1 }, updatedBy: access.user.id },
      });
    }
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: existing ? "treatment.update" : "treatment.submit",
      entityType: "risk_treatment",
      entityId: saved.id,
      after: { riskId, strategy: saved.strategy, status: saved.status, currentStage: saved.currentStage },
      requestId,
    });
    await writeOutbox(tx, {
      tenantId: access.tenant.id,
      type: "treatment.submitted",
      payload: { riskId, treatmentId: saved.id, strategy: saved.strategy, stage: saved.currentStage },
    });
    return mapTreatment(saved);
  });
}

export async function decideApproval(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
  input: DecideApprovalInput,
  requestId?: string,
): Promise<{ treatment: TreatmentRecord; approval: ApprovalRecord } | TreatmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:approve")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const risk = await loadVisibleRisk(tx, access, riskId);
    if (!risk) {
      return "not_found";
    }
    if (!authorize(access, "risk:approve", { orgUnitId: risk.orgUnitId })) {
      return "forbidden";
    }
    const treatment = await tx.riskTreatment.findFirst({
      where: { riskId },
      include: treatmentInclude,
    });
    if (!treatment) {
      return "not_found";
    }
    if (treatment.status !== "pending") {
      return "conflict";
    }
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: access.tenant.id } });
    const policy = parseTenantPolicy(tenant.settingsJson);
    const stage = input.stage ?? treatment.currentStage;
    if (stage !== treatment.currentStage || !policy.approvalStages.includes(stage)) {
      return "invalid";
    }
    if (policy.separationOfDuties && treatment.submittedById === access.membership.id) {
      return "forbidden";
    }
    const next = applyApprovalDecision({
      stages: policy.approvalStages,
      currentStage: treatment.currentStage,
      decision: input.decision,
    });
    const approval = await tx.approval.create({
      data: {
        tenantId: access.tenant.id,
        entityType: "risk_treatment",
        entityId: treatment.id,
        stage,
        approverMembershipId: access.membership.id,
        decision: input.decision,
        comment: input.comment,
      },
      include: approvalInclude,
    });
    const updated = await tx.riskTreatment.update({
      where: { id: treatment.id },
      data: {
        status: next.status,
        currentStage: next.currentStage,
        approvedById: next.status === "approved" ? access.membership.id : null,
        updatedBy: access.user.id,
      },
      include: treatmentInclude,
    });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "approval.decide",
      entityType: "approval",
      entityId: approval.id,
      after: {
        riskId,
        treatmentId: treatment.id,
        decision: approval.decision,
        stage: approval.stage,
        treatmentStatus: updated.status,
      },
      requestId,
    });
    await writeOutbox(tx, {
      tenantId: access.tenant.id,
      type: "approval.decided",
      payload: {
        riskId,
        treatmentId: treatment.id,
        approvalId: approval.id,
        decision: approval.decision,
        stage: approval.stage,
      },
    });
    return { treatment: mapTreatment(updated), approval: mapApproval(approval) };
  });
}
