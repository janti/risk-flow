import { authSubjectFromOidc } from "@riskflow/auth";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { resolveAuthOrigin } from "./lib/canonical-auth-request";
import { provisionUser } from "./lib/provision-user";

process.env.AUTH_URL = resolveAuthOrigin();
const issuer = process.env.AUTH_ISSUER;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  debug: process.env.NODE_ENV !== "production",
  useSecureCookies: false,
  callbacks: {
    async signIn({ profile }) {
      if (profile?.sub && profile.email) {
        return true;
      }
      console.error("OIDC sign-in denied: profile missing sub or email.");
      return false;
    },
    async jwt({ token, account, profile }) {
      if (account && profile?.sub && profile.email) {
        const subjectIssuer = String(account.issuer ?? issuer ?? "");
        const authSubject = authSubjectFromOidc(subjectIssuer, String(profile.sub));
        const user = await provisionUser({
          authSubject,
          email: String(profile.email),
          displayName: String(profile.name ?? profile.email),
        });
        token.authSubject = user.authSubject;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.authSubject && token.userId) {
        session.user.id = token.userId;
        session.user.authSubject = token.authSubject;
      }
      return session;
    },
    async redirect({ url }) {
      const origin = resolveAuthOrigin();
      if (url.startsWith("/")) {
        return `${origin}${url}`;
      }
      try {
        const parsed = new URL(url);
        if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
          return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      } catch {
        return `${origin}/tenants`;
      }
      return `${origin}/tenants`;
    },
  },
});
