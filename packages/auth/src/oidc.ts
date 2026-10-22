export function authSubjectFromOidc(issuer: string, subject: string): string {
  return `${issuer.replace(/\/$/, "")}|${subject}`;
}

export const LOCAL_OIDC_ACCOUNTS = [
  { accountId: "acme-admin", email: "admin@acme.example", name: "Acme Admin" },
  { accountId: "acme-manager", email: "manager@acme.example", name: "Acme Manager" },
  { accountId: "acme-employee", email: "employee@acme.example", name: "Acme Employee" },
  { accountId: "acme-risk-manager", email: "risk-manager@acme.example", name: "Acme Risk Manager" },
  { accountId: "acme-revoked", email: "revoked@acme.example", name: "Acme Revoked" },
  { accountId: "globex-admin", email: "admin@globex.example", name: "Globex Admin" },
  { accountId: "globex-manager", email: "manager@globex.example", name: "Globex Manager" },
  { accountId: "globex-employee", email: "employee@globex.example", name: "Globex Employee" },
  { accountId: "globex-risk-manager", email: "risk-manager@globex.example", name: "Globex Risk Manager" },
  { accountId: "platform-admin", email: "platform@riskflow.example", name: "Platform Admin" },
] as const;

export const LOCAL_OIDC_PASSWORD = "riskflow_dev_only";
