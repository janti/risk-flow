import { findUserByAuthSubject, listActiveMemberships, loadTenantAccess } from "@riskflow/auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "../auth";
import { getAppDatabase } from "./db";

export const getSessionAuthSubject = cache(async () => {
  const session = await auth();
  return session?.user?.authSubject ?? null;
});

export const getCurrentUser = cache(async () => {
  const authSubject = await getSessionAuthSubject();
  if (!authSubject) {
    return null;
  }
  return findUserByAuthSubject(getAppDatabase(), authSubject);
});

export const getCurrentMemberships = cache(async () => {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }
  return listActiveMemberships(getAppDatabase(), user);
});

export const getCurrentTenantAccess = cache(async (tenantSlug: string) => {
  const authSubject = await getSessionAuthSubject();
  if (!authSubject) {
    redirect(`/login?callbackUrl=/t/${tenantSlug}/home`);
  }
  return loadTenantAccess(getAppDatabase(), { authSubject, tenantSlug });
});
