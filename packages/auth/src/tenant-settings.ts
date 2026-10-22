import type { Prisma, TenantDatabase } from "@riskflow/database";
import { z } from "zod";
import { authorize, parseTenantBranding, type TenantAccess, type TenantBranding } from "./access";

export type TenantSettingsError = "forbidden" | "invalid";

export type TenantSettingsRecord = {
  locale: string;
  timezone: string;
  branding: TenantBranding;
};

export const patchTenantSettingsSchema = z.object({
  locale: z.enum(["fi", "sv", "en"]).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  branding: z
    .object({
      productName: z.string().trim().max(80).nullable().optional(),
      primaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .nullable()
        .optional(),
    })
    .optional(),
});

function asSettingsObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

export async function getTenantSettings(
  db: TenantDatabase,
  access: TenantAccess,
): Promise<TenantSettingsRecord | "forbidden"> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }
  return {
    locale: access.tenant.locale,
    timezone: access.tenant.timezone,
    branding: access.tenant.branding,
  };
}

export async function patchTenantSettings(
  db: TenantDatabase,
  access: TenantAccess,
  input: z.infer<typeof patchTenantSettingsSchema>,
): Promise<TenantSettingsRecord | TenantSettingsError> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const current = await tx.tenant.findUniqueOrThrow({ where: { id: access.tenant.id } });
    const settings = asSettingsObject(current.settingsJson);
    if (input.branding) {
      const branding = parseTenantBranding(settings);
      settings.branding = {
        productName: input.branding.productName === undefined ? branding.productName : input.branding.productName,
        primaryColor: input.branding.primaryColor === undefined ? branding.primaryColor : input.branding.primaryColor,
      };
    }
    const updated = await tx.tenant.update({
      where: { id: current.id },
      data: {
        locale: input.locale ?? current.locale,
        timezone: input.timezone ?? current.timezone,
        settingsJson: settings as Prisma.InputJsonValue,
      },
    });
    return {
      locale: updated.locale,
      timezone: updated.timezone,
      branding: parseTenantBranding(updated.settingsJson),
    };
  });
}
