export const PERMISSION_KEYS = [
  "risk:read",
  "risk:create",
  "risk:update",
  "risk:archive",
  "risk:assess",
  "risk:approve",
  "action:assign",
  "action:complete",
  "analytics:read",
  "form:manage",
  "module:manage",
  "users:manage",
  "audit:read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const SYSTEM_ROLE_KEYS = ["employee", "manager", "risk-manager", "tenant-admin"] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const ROLE_PERMISSIONS: Record<SystemRoleKey, readonly PermissionKey[]> = {
  employee: ["risk:read"],
  manager: ["risk:read", "risk:create", "risk:update", "action:assign", "analytics:read"],
  "risk-manager": [
    "risk:read",
    "risk:create",
    "risk:update",
    "risk:archive",
    "risk:assess",
    "risk:approve",
    "action:assign",
    "action:complete",
    "analytics:read",
    "form:manage",
    "audit:read",
  ],
  "tenant-admin": PERMISSION_KEYS,
};

/**
 * Authorization is default-deny. Identity does not imply tenant access.
 */
export function denyByDefault(_permission: PermissionKey): false {
  return false;
}

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export function isSystemRoleKey(value: string): value is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(value);
}

export function hasPermission(
  granted: readonly string[],
  needed: PermissionKey,
): boolean {
  return granted.includes(needed);
}

export type OrgUnitNode = {
  id: string;
  parentId: string | null;
};

/**
 * Unscoped role grants apply to the whole tenant. Scoped grants include the
 * unit and its descendants.
 */
export function expandOrgUnitScope(
  units: readonly OrgUnitNode[],
  grantedUnitIds: readonly string[],
): Set<string> {
  const children = new Map<string, string[]>();
  for (const unit of units) {
    if (!unit.parentId) {
      continue;
    }
    const list = children.get(unit.parentId) ?? [];
    list.push(unit.id);
    children.set(unit.parentId, list);
  }

  const allowed = new Set<string>();
  const queue = [...grantedUnitIds];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || allowed.has(current)) {
      continue;
    }
    allowed.add(current);
    for (const child of children.get(current) ?? []) {
      queue.push(child);
    }
  }
  return allowed;
}

export function orgUnitIsInScope(
  resourceOrgUnitId: string,
  scope: Set<string> | "tenant",
): boolean {
  if (scope === "tenant") {
    return true;
  }
  return scope.has(resourceOrgUnitId);
}
