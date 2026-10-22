import type { Prisma } from "@riskflow/database";

export const TREATMENT_STRATEGIES = ["avoid", "reduce", "share", "accept"] as const;
export type TreatmentStrategy = (typeof TREATMENT_STRATEGIES)[number];

export const TREATMENT_STATUSES = ["pending", "approved", "rejected"] as const;
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number];

export const DEFAULT_APPROVAL_STAGES = ["treatment"] as const;

export type TenantPolicy = {
  separationOfDuties: boolean;
  approvalStages: string[];
};

export const DEFAULT_TENANT_POLICY: TenantPolicy = {
  separationOfDuties: true,
  approvalStages: [...DEFAULT_APPROVAL_STAGES],
};

export function parseTenantPolicy(value: Prisma.JsonValue | null | undefined): TenantPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_TENANT_POLICY;
  }
  const record = value as Record<string, unknown>;
  const stages = Array.isArray(record.approvalStages)
    ? record.approvalStages.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : DEFAULT_TENANT_POLICY.approvalStages;
  return {
    separationOfDuties: record.separationOfDuties !== false,
    approvalStages: stages.length > 0 ? stages : [...DEFAULT_APPROVAL_STAGES],
  };
}

export function applyApprovalDecision(input: {
  stages: readonly string[];
  currentStage: string;
  decision: "approve" | "reject";
}): { status: TreatmentStatus; currentStage: string } {
  if (input.decision === "reject") {
    return { status: "rejected", currentStage: input.currentStage };
  }
  const index = input.stages.indexOf(input.currentStage);
  const next = index >= 0 ? input.stages[index + 1] : undefined;
  if (!next) {
    return { status: "approved", currentStage: input.currentStage };
  }
  return { status: "pending", currentStage: next };
}
