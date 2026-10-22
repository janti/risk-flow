import type { FormError } from "@riskflow/form-engine";
import { serviceErrorResponse } from "./service-error";

export function formMutationResponse(result: FormError, requestId: string): Response {
  return serviceErrorResponse(result, requestId, "Lomake on virheellinen.");
}
