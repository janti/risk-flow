import type { RiskMutationError } from "@riskflow/risk-engine";
import { serviceErrorResponse } from "./service-error";

export function riskMutationResponse(result: RiskMutationError, requestId: string): Response {
  return serviceErrorResponse(result, requestId, "Riski on virheellinen.");
}
