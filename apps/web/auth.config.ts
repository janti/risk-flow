import { customFetch, type NextAuthConfig } from "next-auth";

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

const appOrigin = env("AUTH_URL", "http://127.0.0.1:3000");
const callbackUrl = `${appOrigin}/api/auth/callback/oidc`;

async function fetchOidc(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.body instanceof URLSearchParams && init.body.get("grant_type") === "authorization_code") {
    init.body.set("redirect_uri", callbackUrl);
  }
  return fetch(input, init);
}

export const authConfig = {
  secret: env("AUTH_SECRET", "riskflow_auth_secret_dev_only_min_32_chars"),
  trustHost: true,
  providers: [
    {
      id: "oidc",
      name: "OIDC",
      type: "oidc",
      issuer: env("AUTH_ISSUER", "http://127.0.0.1:3300"),
      clientId: env("AUTH_CLIENT_ID", "riskflow-web"),
      clientSecret: env("AUTH_CLIENT_SECRET", "riskflow_oidc_dev_only"),
      authorization: {
        params: {
          scope: "openid email profile",
          redirect_uri: callbackUrl,
        },
      },
      client: { token_endpoint_auth_method: "client_secret_post" },
      [customFetch]: fetchOidc,
    },
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;
