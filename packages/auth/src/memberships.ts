import type { TenantDatabase } from "@riskflow/database";
import { isSystemRoleKey } from "@riskflow/permissions";
import { authorize, type AuthenticatedUser, type TenantAccess } from "./access";
import { createInviteToken, hashInviteToken } from "./invite-token";
import { isPendingAuthSubject, pendingEmailAuthSubject } from "./pending-user";

export type MembershipListItem = {
  id: string;
  status: string;
  email: string;
  displayName: string;
  roleKeys: string[];
  pending: boolean;
};

export type CreatedInvitation = {
  id: string;
  email: string;
  roleKey: string;
  expiresAt: string;
  token: string;
};

export async function listTenantMemberships(
  db: TenantDatabase,
  access: TenantAccess,
): Promise<MembershipListItem[] | "forbidden"> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }

  return db.withTenant(access.tenant.id, async (tx) => {
    const memberships = await tx.membership.findMany({
      include: { user: true, membershipRoles: { include: { role: true } } },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((membership) => ({
      id: membership.id,
      status: membership.status,
      email: membership.user.email,
      displayName: membership.user.displayName,
      roleKeys: [...new Set(membership.membershipRoles.map((grant) => grant.role.key))],
      pending: isPendingAuthSubject(membership.user.authSubject),
    }));
  });
}

export async function createInvitation(
  db: TenantDatabase,
  access: TenantAccess,
  input: { email: string; roleKey: string; orgUnitId?: string },
): Promise<CreatedInvitation | "forbidden" | "invalid" | "conflict"> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@") || !isSystemRoleKey(input.roleKey)) {
    return "invalid";
  }

  const invite = createInviteToken();
  try {
    const created = await db.withTenant(access.tenant.id, async (tx) => {
      if (input.orgUnitId) {
        const unit = await tx.orgUnit.findFirst({ where: { id: input.orgUnitId } });
        if (!unit) {
          return null;
        }
      }
      return tx.invitation.create({
        data: {
          tenantId: access.tenant.id,
          email,
          roleKey: input.roleKey,
          orgUnitId: input.orgUnitId,
          tokenHash: invite.tokenHash,
          expiresAt: invite.expiresAt,
          invitedByMembershipId: access.membership.id,
        },
      });
    });
    if (!created) {
      return "invalid";
    }
    return {
      id: created.id,
      email: created.email,
      roleKey: created.roleKey,
      expiresAt: created.expiresAt.toISOString(),
      token: invite.token,
    };
  } catch {
    return "conflict";
  }
}

export async function acceptInvitation(
  db: TenantDatabase,
  user: AuthenticatedUser,
  token: string,
): Promise<"accepted" | "invalid"> {
  const tokenHash = hashInviteToken(token);
  const invite = await db.withInviteToken(tokenHash, (tx) =>
    tx.invitation.findUnique({ where: { tokenHash } }),
  );
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
    return "invalid";
  }
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return "invalid";
  }

  try {
    await db.withTenant(invite.tenantId, async (tx) => {
      const role = await tx.role.findUnique({
        where: { tenantId_key: { tenantId: invite.tenantId, key: invite.roleKey } },
      });
      if (!role) {
        throw new Error("missing role");
      }
      const membership = await tx.membership.upsert({
        where: { tenantId_userId: { tenantId: invite.tenantId, userId: user.id } },
        create: {
          tenantId: invite.tenantId,
          userId: user.id,
          status: "active",
          createdBy: invite.invitedByMembershipId,
        },
        update: { status: "active" },
      });
      const existingGrant = await tx.membershipRole.findFirst({
        where: { membershipId: membership.id, roleId: role.id },
      });
      if (!existingGrant) {
        await tx.membershipRole.create({
          data: {
            tenantId: invite.tenantId,
            membershipId: membership.id,
            roleId: role.id,
            orgUnitId: invite.orgUnitId,
          },
        });
      }
      await tx.invitation.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    });
    return "accepted";
  } catch {
    return "invalid";
  }
}

export async function addMemberDirectly(
  db: TenantDatabase,
  access: TenantAccess,
  input: { email: string; roleKey: string; orgUnitId?: string; displayName?: string },
): Promise<MembershipListItem | "forbidden" | "invalid" | "conflict"> {
  if (!authorize(access, "users:manage")) {
    return "forbidden";
  }
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@") || !isSystemRoleKey(input.roleKey)) {
    return "invalid";
  }
  const displayName = input.displayName?.trim() || email.split("@")[0] || email;

  try {
    return await db.withTenant(access.tenant.id, async (tx) => {
      if (input.orgUnitId) {
        const unit = await tx.orgUnit.findFirst({ where: { id: input.orgUnitId } });
        if (!unit) {
          throw new Error("invalid");
        }
      }

      const role = await tx.role.findUnique({
        where: { tenantId_key: { tenantId: access.tenant.id, key: input.roleKey } },
      });
      if (!role) {
        throw new Error("invalid");
      }

      let user = await tx.user.findFirst({ where: { email } });
      user ??= await tx.user.create({
        data: {
          authSubject: pendingEmailAuthSubject(email),
          email,
          displayName,
          platformAdmin: false,
        },
      });

      const existing = await tx.membership.findUnique({
        where: { tenantId_userId: { tenantId: access.tenant.id, userId: user.id } },
      });
      if (existing?.status === "active") {
        throw new Error("conflict");
      }

      const membership = await tx.membership.upsert({
        where: { tenantId_userId: { tenantId: access.tenant.id, userId: user.id } },
        create: {
          tenantId: access.tenant.id,
          userId: user.id,
          status: "active",
          createdBy: access.membership.id,
        },
        update: { status: "active", updatedBy: access.membership.id },
      });

      const existingGrant = await tx.membershipRole.findFirst({
        where: { membershipId: membership.id, roleId: role.id },
      });
      if (!existingGrant) {
        await tx.membershipRole.create({
          data: {
            tenantId: access.tenant.id,
            membershipId: membership.id,
            roleId: role.id,
            orgUnitId: input.orgUnitId,
          },
        });
      }

      const membershipRoles = await tx.membershipRole.findMany({
        where: { membershipId: membership.id },
        include: { role: true },
      });
      return {
        id: membership.id,
        status: membership.status,
        email: user.email,
        displayName: user.displayName,
        roleKeys: [...new Set(membershipRoles.map((grant) => grant.role.key))],
        pending: isPendingAuthSubject(user.authSubject),
      };
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "invalid" || error.message === "conflict")) {
      return error.message;
    }
    throw error;
  }
}
