import { jsonError } from "./api-route";

export function serviceErrorResponse(
  result: string,
  requestId: string,
  invalidMessage = "Pyyntö on virheellinen.",
): Response {
  if (result === "module_disabled") {
    return jsonError(403, "module_disabled", "Moduuli ei ole käytössä.", requestId);
  }
  if (result === "not_entitled") {
    return jsonError(403, "not_entitled", "Moduuli ei kuulu tenantin entitlementteihin.", requestId);
  }
  if (result === "forbidden") {
    return jsonError(403, "forbidden", "Toiminto ei ole sallittu.", requestId);
  }
  if (result === "not_found") {
    return jsonError(404, "not_found", "Resurssia ei löytynyt.", requestId);
  }
  if (result === "invalid") {
    return jsonError(400, "invalid_body", invalidMessage, requestId);
  }
  if (result === "stale") {
    return jsonError(409, "conflict", "Tietue on muuttunut. Päivitä ja yritä uudelleen.", requestId);
  }
  if (result === "expired") {
    return jsonError(403, "expired", "Allekirjoitettu osoite on vanhentunut.", requestId);
  }
  if (result === "infected") {
    return jsonError(403, "infected", "Liite ei läpäissyt tarkistusta.", requestId);
  }
  if (result === "pending_scan") {
    return jsonError(409, "pending_scan", "Liite odottaa tarkistusta.", requestId);
  }
  return jsonError(409, "conflict", "Toiminto on ristiriidassa nykyisen tilan kanssa.", requestId);
}
