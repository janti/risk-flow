import { serviceErrorResponse } from "./service-error";

type WorkflowError = "forbidden" | "not_found" | "invalid" | "conflict" | "module_disabled";

export function workflowMutationResponse(result: WorkflowError, requestId: string, invalidMessage: string): Response {
  return serviceErrorResponse(result, requestId, invalidMessage);
}
