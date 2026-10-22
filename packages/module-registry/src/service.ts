import { authorize, type TenantAccess } from "@riskflow/auth";
import type { Prisma, TenantDatabase, TenantTransaction } from "@riskflow/database";
import { z } from "zod";
import { isModuleKey, MODULE_CATALOG, MODULE_LABELS, type ModuleKey } from "./catalog";
import { assertAcyclicCatalog } from "./graph";

assertAcyclicCatalog(MODULE_CATALOG);

export type ModuleError = "forbidden" | "not_found" | "invalid" | "conflict" | "not_entitled" | "module_disabled";

export type ModuleRecord = {
  key: ModuleKey;
  label: string;
  version: string;
  dependencies: ModuleKey[];
  entitled: boolean;
  enabled: boolean;
  settings: Record<string, unknown>;
};

export const patchModulesSchema = z.object({
  modules: z
    .array(
      z.object({
        key: z.string().min(1),
        enabled: z.boolean(),
        settings: z.record(z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export type PatchModulesInput = z.infer<typeof patchModulesSchema>;

function parseSettings(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

async function writeAudit(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    actorUserId: string;
    action: string;
    entityId: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    requestId?: string;
  },
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: "module",
      entityId: input.entityId,
      beforeJson: input.before,
      afterJson: input.after,
      requestId: input.requestId,
    },
  });
}

export async function listTenantModules(
  db: TenantDatabase,
  access: TenantAccess,
): Promise<ModuleRecord[] | "forbidden"> {
  if (!authorize(access, "module:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, (tx) => loadModuleRecords(tx));
}

export async function loadEnabledModuleKeys(tx: TenantTransaction): Promise<string[]> {
  const rows = await tx.tenantModule.findMany({ where: { enabled: true }, select: { moduleKey: true } });
  return rows.map((row) => row.moduleKey);
}

async function loadModuleRecords(tx: TenantTransaction): Promise<ModuleRecord[]> {
  const [entitlements, modules] = await Promise.all([
    tx.tenantEntitlement.findMany(),
    tx.tenantModule.findMany(),
  ]);
  const entitled = new Map(entitlements.map((row) => [row.moduleKey, row.entitled]));
  const enabled = new Map(modules.map((row) => [row.moduleKey, row]));
  return MODULE_CATALOG.map((entry) => {
    const row = enabled.get(entry.key);
    return {
      key: entry.key,
      label: MODULE_LABELS[entry.key],
      version: entry.version,
      dependencies: [...entry.dependencies],
      entitled: entitled.get(entry.key) === true,
      enabled: row?.enabled === true,
      settings: parseSettings(row?.settingsJson ?? {}),
    };
  });
}

export async function patchTenantModules(
  db: TenantDatabase,
  access: TenantAccess,
  input: PatchModulesInput,
  requestId?: string,
): Promise<ModuleRecord[] | ModuleError> {
  if (!authorize(access, "module:manage")) {
    return "forbidden";
  }
  const keys = input.modules.map((item) => item.key);
  if (keys.some((key) => !isModuleKey(key))) {
    return "invalid";
  }

  return db.withTenant(access.tenant.id, async (tx) => {
    const current = await loadModuleRecords(tx);
    const byKey = new Map(current.map((item) => [item.key, item]));
    const next = new Map(current.map((item) => [item.key, { ...item }]));

    for (const change of input.modules) {
      const module = byKey.get(change.key as ModuleKey);
      if (!module) {
        return "not_found";
      }
      if (change.enabled && !module.entitled) {
        return "not_entitled";
      }
      const updated = next.get(change.key as ModuleKey)!;
      updated.enabled = change.enabled;
      if (change.settings) {
        updated.settings = change.settings;
      }
    }

    for (const module of next.values()) {
      if (module.enabled) {
        const missing = module.dependencies.filter((dependency) => next.get(dependency)?.enabled !== true);
        if (missing.length > 0) {
          return "conflict";
        }
      }
    }

    for (const module of next.values()) {
      if (!module.enabled) {
        const blockers = [...next.values()].filter(
          (item) => item.enabled && item.dependencies.includes(module.key),
        );
        if (blockers.length > 0) {
          return "conflict";
        }
      }
    }

    for (const change of input.modules) {
      const key = change.key as ModuleKey;
      const before = byKey.get(key)!;
      const after = next.get(key)!;
      await tx.tenantModule.upsert({
        where: { tenantId_moduleKey: { tenantId: access.tenant.id, moduleKey: key } },
        create: {
          tenantId: access.tenant.id,
          moduleKey: key,
          enabled: after.enabled,
          settingsJson: after.settings as Prisma.InputJsonValue,
          createdBy: access.membership.id,
          updatedBy: access.membership.id,
        },
        update: {
          enabled: after.enabled,
          settingsJson: after.settings as Prisma.InputJsonValue,
          updatedBy: access.membership.id,
        },
      });
      await writeAudit(tx, {
        tenantId: access.tenant.id,
        actorUserId: access.user.id,
        action: after.enabled ? "module.enable" : "module.disable",
        entityId: access.tenant.id,
        before: { key, enabled: before.enabled },
        after: { key, enabled: after.enabled },
        requestId,
      });
    }

    return loadModuleRecords(tx);
  });
}

export function moduleIsEnabled(access: { enabledModules: readonly string[] }, key: string): boolean {
  return access.enabledModules.includes(key);
}
