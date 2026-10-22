import type { TenantDatabase, TenantTransaction } from "@riskflow/database";
import {
  expandOrgUnitScope,
  hasPermission,
  type PermissionKey,
  type SystemRoleKey,
} from "@riskflow/permissions";
import { parseLocale, type AppLocale } from "@riskflow/shared";
import { assertTenantSlug } from "@riskflow/tenant";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  authSubject: string;
  platformAdmin: boolean;
  locale: AppLocale;
};

export type MembershipSummary = {
  id: string;
  status: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: string;
  roleKeys: string[];
};

export type TenantBranding = {
  productName: string | null;
  primaryColor: string | null;
};

export type TenantAccess = {
  user: AuthenticatedUser;
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
    locale: string;
    timezone: string;
    branding: TenantBranding;
  };
  membership: {
    id: string;
    status: "active";
  };
  roleKeys: string[];
  permissionKeys: PermissionKey[];
  orgUnitScope: Set<string> | "tenant";
  enabledModules: string[];
};

export async function findUserByAuthSubject(
  db: TenantDatabase,
  authSubject: string,
): Promise<AuthenticatedUser | null> {
  return db.withoutTenantContext(async (tx) => {
    const user = await tx.user.findUnique({ where: { authSubject } });
    if (!user) {
      return null;
    }
    return mapAuthenticatedUser(user);
  });
}

function mapAuthenticatedUser(user: {
  id: string;
  email: string;
  displayName: string;
  authSubject: string;
  platformAdmin: boolean;
  locale: string;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    authSubject: user.authSubject,
    platformAdmin: user.platformAdmin,
    locale: parseLocale(user.locale),
  };
}

export async function updateUserLocale(
  db: TenantDatabase,
  user: AuthenticatedUser,
  locale: AppLocale,
): Promise<AuthenticatedUser> {
  return db.withoutTenantContext(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { locale },
    });
    return mapAuthenticatedUser(updated);
  });
}

export async function listActiveMemberships(
  db: TenantDatabase,
  user: AuthenticatedUser,
): Promise<MembershipSummary[]> {
  const memberships = await db.withUser(user.id, (tx) =>
    tx.membership.findMany({
      where: { userId: user.id, status: "active" },
      include: { tenant: true },
    }),
  );

  const summaries: MembershipSummary[] = [];
  for (const membership of memberships) {
    const roleKeys = await db.withTenant(membership.tenantId, async (tx) =>
      loadRoleKeys(tx, membership.id),
    );
    summaries.push({
      id: membership.id,
      status: membership.status,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenant.slug,
      tenantName: membership.tenant.name,
      tenantStatus: membership.tenant.status,
      roleKeys,
    });
  }
  return summaries;
}

export async function loadTenantAccess(
  db: TenantDatabase,
  input: { authSubject: string; tenantSlug: string },
): Promise<TenantAccess | null> {
  const slug = assertTenantSlug(input.tenantSlug);
  const user = await findUserByAuthSubject(db, input.authSubject);
  if (!user) {
    return null;
  }

  const tenant = await db.withoutTenantContext((tx) => tx.tenant.findUnique({ where: { slug } }));
  if (!tenant || tenant.status !== "active") {
    return null;
  }

  return db.withTenant(tenant.id, async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { userId: user.id, status: "active" },
    });
    if (!membership) {
      return null;
    }

    const membershipRoles = await tx.membershipRole.findMany({
      where: { membershipId: membership.id },
      include: { role: { include: { rolePermissions: true } } },
    });
    const roleKeys = [...new Set(membershipRoles.map((item) => item.role.key))];
    const permissionKeys = [
      ...new Set(membershipRoles.flatMap((item) => item.role.rolePermissions.map((row) => row.permissionKey))),
    ] as PermissionKey[];

    const scopedUnitIds = membershipRoles
      .map((item) => item.orgUnitId)
      .filter((value): value is string => Boolean(value));
    const hasUnscopedGrant = membershipRoles.some((item) => item.orgUnitId === null);
    const units = await tx.orgUnit.findMany({ select: { id: true, parentId: true } });
    const orgUnitScope = hasUnscopedGrant || scopedUnitIds.length === 0
      ? ("tenant" as const)
      : expandOrgUnitScope(units, scopedUnitIds);
    const enabledModules = (
      await tx.tenantModule.findMany({ where: { enabled: true }, select: { moduleKey: true } })
    ).map((row) => row.moduleKey);

    return {
      user,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        locale: tenant.locale,
        timezone: tenant.timezone,
        branding: parseTenantBranding(tenant.settingsJson),
      },
      membership: { id: membership.id, status: "active" },
      roleKeys,
      permissionKeys,
      orgUnitScope,
      enabledModules,
    };
  });
}

export function hasEnabledModule(access: { enabledModules: readonly string[] }, key: string): boolean {
  return access.enabledModules.includes(key);
}

export function parseTenantBranding(value: unknown): TenantBranding {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { productName: null, primaryColor: null };
  }
  const branding = (value as Record<string, unknown>).branding;
  if (!branding || typeof branding !== "object" || Array.isArray(branding)) {
    return { productName: null, primaryColor: null };
  }
  const record = branding as Record<string, unknown>;
  return {
    productName: typeof record.productName === "string" ? record.productName : null,
    primaryColor: typeof record.primaryColor === "string" ? record.primaryColor : null,
  };
}

export function authorize(
  access: TenantAccess,
  permission: PermissionKey,
  resource?: { orgUnitId?: string },
): boolean {
  if (access.membership.status !== "active") {
    return false;
  }
  if (!hasPermission(access.permissionKeys, permission)) {
    return false;
  }
  if (resource?.orgUnitId && access.orgUnitScope !== "tenant") {
    return access.orgUnitScope.has(resource.orgUnitId);
  }
  return true;
}

export function isSystemRole(value: string): value is SystemRoleKey {
  return value === "employee" || value === "manager" || value === "risk-manager" || value === "tenant-admin";
}

async function loadRoleKeys(tx: TenantTransaction, membershipId: string): Promise<string[]> {
  const grants = await tx.membershipRole.findMany({
    where: { membershipId },
    include: { role: true },
  });
  return [...new Set(grants.map((grant) => grant.role.key))];
}
