import type { TenantDatabase, TenantTransaction } from "@riskflow/database";
import { z } from "zod";
import { authorize, type TenantAccess } from "./access";

export type OrgUnitError = "forbidden" | "not_found" | "invalid" | "conflict";

export type OrgUnitRecord = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  children: OrgUnitRecord[];
};

export const createOrgUnitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["company", "division", "department", "team"]).default("team"),
  parentId: z.string().uuid().nullable().optional(),
});

export const patchOrgUnitSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["company", "division", "department", "team"]).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

type OrgUnitRow = { id: string; name: string; type: string; parentId: string | null };

function toTree(rows: OrgUnitRow[]): OrgUnitRecord[] {
  const byId = new Map<string, OrgUnitRecord>();
  for (const row of rows) {
    byId.set(row.id, { id: row.id, name: row.name, type: row.type, parentId: row.parentId, children: [] });
  }
  const roots: OrgUnitRecord[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: OrgUnitRecord[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "fi"));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);
  return roots;
}

async function wouldCycle(tx: TenantTransaction, unitId: string, parentId: string | null): Promise<boolean> {
  let current = parentId;
  const seen = new Set<string>();
  while (current) {
    if (current === unitId || seen.has(current)) {
      return true;
    }
    seen.add(current);
    const parent = await tx.orgUnit.findUnique({ where: { id: current }, select: { parentId: true } });
    current = parent?.parentId ?? null;
  }
  return false;
}

export async function listOrgUnits(
  db: TenantDatabase,
  access: TenantAccess,
): Promise<OrgUnitRecord[] | "forbidden"> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const rows = await tx.orgUnit.findMany({
      select: { id: true, name: true, type: true, parentId: true },
    });
    return toTree(rows);
  });
}

export async function createOrgUnit(
  db: TenantDatabase,
  access: TenantAccess,
  input: z.infer<typeof createOrgUnitSchema>,
): Promise<OrgUnitRecord[] | OrgUnitError> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    if (input.parentId) {
      const parent = await tx.orgUnit.findUnique({ where: { id: input.parentId } });
      if (!parent) {
        return "invalid";
      }
    }
    await tx.orgUnit.create({
      data: {
        tenantId: access.tenant.id,
        name: input.name,
        type: input.type,
        parentId: input.parentId ?? null,
        createdBy: access.membership.id,
        updatedBy: access.membership.id,
      },
    });
    const rows = await tx.orgUnit.findMany({
      select: { id: true, name: true, type: true, parentId: true },
    });
    return toTree(rows);
  });
}

export async function patchOrgUnit(
  db: TenantDatabase,
  access: TenantAccess,
  input: z.infer<typeof patchOrgUnitSchema>,
): Promise<OrgUnitRecord[] | OrgUnitError> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const existing = await tx.orgUnit.findUnique({ where: { id: input.id } });
    if (!existing) {
      return "not_found";
    }
    const nextParentId = input.parentId === undefined ? existing.parentId : input.parentId;
    if (nextParentId) {
      const parent = await tx.orgUnit.findUnique({ where: { id: nextParentId } });
      if (!parent) {
        return "invalid";
      }
      if (await wouldCycle(tx, existing.id, nextParentId)) {
        return "conflict";
      }
    }
    try {
      await tx.orgUnit.update({
        where: { id: existing.id },
        data: {
          name: input.name ?? existing.name,
          type: input.type ?? existing.type,
          parentId: nextParentId,
          updatedBy: access.membership.id,
        },
      });
    } catch {
      return "conflict";
    }
    const rows = await tx.orgUnit.findMany({
      select: { id: true, name: true, type: true, parentId: true },
    });
    return toTree(rows);
  });
}
