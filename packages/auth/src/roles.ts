import type { TenantDatabase, TenantTransaction } from "@riskflow/database";
import { isPermissionKey, PERMISSION_KEYS, type PermissionKey } from "@riskflow/permissions";
import { z } from "zod";
import { authorize, type TenantAccess } from "./access";

export type RoleError = "forbidden" | "not_found" | "invalid" | "conflict";

export type RoleMatrixRecord = {
  id: string;
  key: string;
  label: string;
  isSystem: boolean;
  permissionKeys: PermissionKey[];
};

export const patchRolesSchema = z.object({
  roles: z
    .array(
      z.object({
        roleId: z.string().uuid(),
        permissionKeys: z.array(z.string()).max(PERMISSION_KEYS.length),
      }),
    )
    .min(1)
    .max(20),
});

async function loadMatrix(tx: TenantTransaction): Promise<RoleMatrixRecord[]> {
  const roles = await tx.role.findMany({
    include: { rolePermissions: true },
    orderBy: { key: "asc" },
  });
  return roles.map((role) => ({
    id: role.id,
    key: role.key,
    label: role.label,
    isSystem: role.isSystem,
    permissionKeys: role.rolePermissions
      .map((row) => row.permissionKey)
      .filter(isPermissionKey)
      .sort(),
  }));
}

export async function listRoleMatrix(
  db: TenantDatabase,
  access: TenantAccess,
): Promise<RoleMatrixRecord[] | "forbidden"> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, (tx) => loadMatrix(tx));
}

export async function patchRoleMatrix(
  db: TenantDatabase,
  access: TenantAccess,
  input: z.infer<typeof patchRolesSchema>,
  requestId?: string,
): Promise<RoleMatrixRecord[] | RoleError> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }
  for (const change of input.roles) {
    if (change.permissionKeys.some((key) => !isPermissionKey(key))) {
      return "invalid";
    }
  }

  return db.withTenant(access.tenant.id, async (tx) => {
    const current = await loadMatrix(tx);
    const byId = new Map(current.map((role) => [role.id, role]));

    for (const change of input.roles) {
      const role = byId.get(change.roleId);
      if (!role) {
        return "not_found";
      }
      const next = [...new Set(change.permissionKeys)].filter(isPermissionKey);
      if (role.key === "tenant-admin" && (!next.includes("users:manage") || !next.includes("module:manage"))) {
        return "conflict";
      }
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id, permissionKey: { notIn: next } },
      });
      for (const permissionKey of next) {
        await tx.rolePermission.upsert({
          where: {
            tenantId_roleId_permissionKey: {
              tenantId: access.tenant.id,
              roleId: role.id,
              permissionKey,
            },
          },
          create: { tenantId: access.tenant.id, roleId: role.id, permissionKey },
          update: {},
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: access.tenant.id,
          actorUserId: access.user.id,
          action: "role.permissions.update",
          entityType: "role",
          entityId: role.id,
          beforeJson: { permissionKeys: role.permissionKeys },
          afterJson: { permissionKeys: next },
          requestId,
        },
      });
    }

    return loadMatrix(tx);
  });
}
