import { buttonVariants, EmptyState, PageHeader } from "@riskflow/ui";
import { t } from "@riskflow/shared";
import { PublicChrome } from "../../components/public-chrome";
import { getCurrentMemberships, getCurrentUser } from "../../lib/current-access";
import { resolveRequestLocale } from "../../lib/locale";

export default async function TenantSelectPage() {
  const user = await getCurrentUser();
  const memberships = await getCurrentMemberships();
  const locale = await resolveRequestLocale();

  return (
    <PublicChrome>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 p-6">
        <PageHeader
          title={t(locale, "auth.chooseOrg")}
          description={user ? t(locale, "auth.signedInAs", { name: user.displayName }) : t(locale, "auth.loginRequired")}
        />
        {user?.platformAdmin ? (
          <p className="text-sm text-muted-foreground">{t(locale, "auth.platformAdminNote")}</p>
        ) : null}
        {memberships.length === 0 ? (
          <EmptyState title={t(locale, "auth.noMembershipsTitle")} description={t(locale, "auth.noMembershipsDescription")} />
        ) : (
          <ul className="space-y-3">
            {memberships.map((membership) => (
              <li key={membership.id}>
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href={`/t/${membership.tenantSlug}/home`}
                  data-testid={`tenant-${membership.tenantSlug}`}
                >
                  {membership.tenantName}
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PublicChrome>
  );
}
