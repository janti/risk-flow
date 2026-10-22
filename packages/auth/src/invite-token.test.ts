import { describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken, inviteTokensEqual } from "./invite-token";
import { assertSafeMutation } from "./csrf";
import { authSubjectFromOidc } from "./oidc";

describe("invite tokens", () => {
  it("hashes the raw token and does not embed it in the hash", () => {
    const invite = createInviteToken();
    expect(invite.tokenHash).toBe(hashInviteToken(invite.token));
    expect(invite.tokenHash).not.toContain(invite.token);
    expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("compares hashes in constant time", () => {
    const hash = hashInviteToken("secret-token");
    expect(inviteTokensEqual(hash, hashInviteToken("secret-token"))).toBe(true);
    expect(inviteTokensEqual(hash, hashInviteToken("other"))).toBe(false);
  });
});

describe("csrf origin check", () => {
  it("allows same-origin mutations", () => {
    const request = new Request("http://127.0.0.1:3000/api/v1/me", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3000" },
    });
    expect(() => assertSafeMutation(request, "http://127.0.0.1:3000")).not.toThrow();
  });

  it("rejects cross-origin mutations", () => {
    const request = new Request("http://127.0.0.1:3000/api/v1/me", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertSafeMutation(request, "http://127.0.0.1:3000")).toThrow("CSRF_REJECTED");
  });

  it("allows GET without origin", () => {
    const request = new Request("http://127.0.0.1:3000/api/v1/me");
    expect(() => assertSafeMutation(request, "http://127.0.0.1:3000")).not.toThrow();
  });
});

describe("oidc subject", () => {
  it("combines issuer and subject", () => {
    expect(authSubjectFromOidc("http://127.0.0.1:3300/", "acme-admin")).toBe(
      "http://127.0.0.1:3300|acme-admin",
    );
  });
});
