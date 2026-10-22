import type { TenantDatabase } from "@riskflow/database";

export const PENDING_EMAIL_PREFIX = "pending-email|";

export function pendingEmailAuthSubject(email: string): string {
  return `${PENDING_EMAIL_PREFIX}${email.trim().toLowerCase()}`;
}

export function isPendingAuthSubject(value: string): boolean {
  return value.startsWith(PENDING_EMAIL_PREFIX);
}

export async function claimOrCreateUser(
  db: TenantDatabase,
  input: { authSubject: string; email: string; displayName: string },
): Promise<{ id: string; authSubject: string }> {
  const email = input.email.trim().toLowerCase();
  return db.withoutTenantContext(async (tx) => {
    const existing = await tx.user.findUnique({ where: { authSubject: input.authSubject } });
    if (existing) {
      const updated = await tx.user.update({
        where: { id: existing.id },
        data: { email, displayName: input.displayName },
      });
      return { id: updated.id, authSubject: updated.authSubject };
    }

    const pending = await tx.user.findUnique({
      where: { authSubject: pendingEmailAuthSubject(email) },
    });
    if (pending) {
      const claimed = await tx.user.update({
        where: { id: pending.id },
        data: {
          authSubject: input.authSubject,
          email,
          displayName: input.displayName,
        },
      });
      return { id: claimed.id, authSubject: claimed.authSubject };
    }

    const created = await tx.user.create({
      data: {
        authSubject: input.authSubject,
        email,
        displayName: input.displayName,
        platformAdmin: false,
      },
    });
    return { id: created.id, authSubject: created.authSubject };
  });
}
