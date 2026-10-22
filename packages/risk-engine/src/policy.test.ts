import { describe, expect, it } from "vitest";
import { applyApprovalDecision, DEFAULT_TENANT_POLICY, parseTenantPolicy } from "./policy";

describe("tenant approval policy", () => {
  it("defaults to separation of duties and a treatment stage", () => {
    expect(parseTenantPolicy(null)).toEqual(DEFAULT_TENANT_POLICY);
    expect(parseTenantPolicy({ separationOfDuties: false, approvalStages: ["treatment", "acceptance"] })).toEqual({
      separationOfDuties: false,
      approvalStages: ["treatment", "acceptance"],
    });
  });

  it("advances through configured stages and rejects without skipping", () => {
    expect(
      applyApprovalDecision({
        stages: ["treatment", "acceptance"],
        currentStage: "treatment",
        decision: "approve",
      }),
    ).toEqual({ status: "pending", currentStage: "acceptance" });
    expect(
      applyApprovalDecision({
        stages: ["treatment", "acceptance"],
        currentStage: "acceptance",
        decision: "approve",
      }),
    ).toEqual({ status: "approved", currentStage: "acceptance" });
    expect(
      applyApprovalDecision({
        stages: ["treatment"],
        currentStage: "treatment",
        decision: "reject",
      }),
    ).toEqual({ status: "rejected", currentStage: "treatment" });
  });
});
