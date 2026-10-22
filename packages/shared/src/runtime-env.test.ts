import { describe, expect, it } from "vitest";
import { inspectRuntimeSecrets, parseAppEnvironment } from "./runtime-env";

describe("runtime secrets", () => {
  it("accepts local development values", () => {
    expect(parseAppEnvironment("development")).toBe("development");
    expect(
      inspectRuntimeSecrets({
        APP_ENV: "development",
        AUTH_SECRET: "riskflow_auth_secret_dev_only_min_32_chars",
        OBJECT_SIGNING_SECRET: "riskflow_object_signing_secret_dev_only_min_32",
      }),
    ).toEqual([]);
  });

  it("rejects production secrets that are local-dev placeholders", () => {
    const issues = inspectRuntimeSecrets({
      APP_ENV: "production",
      AUTH_URL: "http://example.com",
      AUTH_SECRET: "riskflow_auth_secret_dev_only_min_32_chars",
      OBJECT_SIGNING_SECRET: "riskflow_object_signing_secret_dev_only_min_32",
      AUTH_CLIENT_SECRET: "riskflow_oidc_dev_only",
      DATABASE_URL: "postgresql://riskflow:riskflow_dev_only@localhost/riskflow",
    });
    expect(issues.map((issue) => issue.key)).toEqual(
      expect.arrayContaining(["AUTH_URL", "AUTH_SECRET", "OBJECT_SIGNING_SECRET", "AUTH_CLIENT_SECRET", "DATABASE_URL"]),
    );
  });
});
