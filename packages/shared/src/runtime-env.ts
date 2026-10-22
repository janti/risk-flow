const DEV_ONLY_MARKER = "dev_only";

export type AppEnvironment = "development" | "staging" | "production";

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === "staging" || value === "production") {
    return value;
  }
  return "development";
}

export type RuntimeSecretIssue = {
  key: string;
  reason: string;
};

type ProcessEnv = Record<string, string | undefined>;

export function inspectRuntimeSecrets(env: ProcessEnv = process.env): RuntimeSecretIssue[] {
  const appEnv = parseAppEnvironment(env.APP_ENV ?? env.NODE_ENV);
  const issues: RuntimeSecretIssue[] = [];
  const authSecret = env.AUTH_SECRET ?? "";
  if (authSecret.length < 32) {
    issues.push({ key: "AUTH_SECRET", reason: "must be at least 32 characters" });
  }
  const signingSecret = env.OBJECT_SIGNING_SECRET ?? "";
  if (signingSecret.length < 32) {
    issues.push({ key: "OBJECT_SIGNING_SECRET", reason: "must be at least 32 characters" });
  }
  if (appEnv === "production") {
    const authUrl = env.AUTH_URL ?? "";
    if (!authUrl.startsWith("https://")) {
      issues.push({ key: "AUTH_URL", reason: "production requires https" });
    }
    for (const key of ["AUTH_SECRET", "AUTH_CLIENT_SECRET", "OBJECT_SIGNING_SECRET", "DATABASE_URL"] as const) {
      const value = env[key] ?? "";
      if (value.includes(DEV_ONLY_MARKER)) {
        issues.push({ key, reason: "production cannot use local-dev secrets" });
      }
    }
  }
  return issues;
}

export function assertRuntimeSecrets(env: ProcessEnv = process.env): void {
  const appEnv = parseAppEnvironment(env.APP_ENV ?? env.NODE_ENV);
  if (appEnv === "development") {
    return;
  }
  const issues = inspectRuntimeSecrets(env);
  if (issues.length > 0) {
    const summary = issues.map((issue) => `${issue.key}: ${issue.reason}`).join("; ");
    throw new Error(`Invalid runtime secrets (${appEnv}): ${summary}`);
  }
}
