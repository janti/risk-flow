import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);
const protectedPrefixes = ["/t/", "/tenants", "/invite/"];
const canonicalOrigin = process.env.AUTH_URL && process.env.AUTH_URL.length > 0 ? process.env.AUTH_URL : "http://127.0.0.1:3000";

export default auth((request) => {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("localhost")) {
    const canonical = new URL(request.nextUrl.pathname + request.nextUrl.search, canonicalOrigin);
    return Response.redirect(canonical);
  }

  const { pathname } = request.nextUrl;
  const needsSession = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
  if (needsSession && !request.auth) {
    const login = new URL("/login", canonicalOrigin);
    login.searchParams.set("callbackUrl", pathname);
    return Response.redirect(login);
  }
  return undefined;
});

export const config = {
  matcher: ["/t/:path*", "/tenants", "/tenants/:path*", "/invite/:path*", "/login"],
};
