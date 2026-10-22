import type { RiskLookups, RiskRecord } from "@riskflow/risk-engine";

export type RiskPermissions = {
  create: boolean;
  update: boolean;
  archive: boolean;
  assess: boolean;
  assign: boolean;
  complete: boolean;
  approve: boolean;
};

export type { RiskLookups, RiskRecord };
