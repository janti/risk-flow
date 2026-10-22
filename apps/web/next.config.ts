import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSecurityHeaders } from "@riskflow/shared";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(repoRoot, ".env.example") });

const securityHeaders = buildSecurityHeaders();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  env: {
    AUTH_URL:
      process.env.AUTH_URL && process.env.AUTH_URL.length > 0
        ? process.env.AUTH_URL
        : "http://127.0.0.1:3000",
  },
  transpilePackages: [
    "@riskflow/ui",
    "@riskflow/shared",
    "@riskflow/tenant",
    "@riskflow/permissions",
    "@riskflow/module-registry",
    "@riskflow/auth",
    "@riskflow/database",
    "@riskflow/form-engine",
    "@riskflow/risk-engine",
  ],
  serverExternalPackages: ["@prisma/client"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
