import { isTenantSlug } from "@riskflow/shared";

export type TenantStatus = "active" | "suspended" | "provisioning";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  locale: string;
  timezone: string;
};

/**
 * Tenant identity must be derived from verified membership, never from an
 * untrusted JSON body.
 */
export function assertTenantSlug(slug: string): string {
  if (!isTenantSlug(slug)) {
    throw new Error("Invalid tenant slug.");
  }
  return slug;
}
