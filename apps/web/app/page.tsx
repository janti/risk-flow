import { buttonVariants, PageHeader, StatusBadge } from "@riskflow/ui";
import { t } from "@riskflow/shared";
import { PublicChrome } from "../components/public-chrome";
import { auth } from "../auth";
import { resolveRequestLocale } from "../lib/locale";

export default async function LandingPage() {
  const session = await auth();
  const locale = await resolveRequestLocale();
  const signedIn = Boolean(session?.user?.authSubject);

  return (
    <PublicChrome>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 p-6">
        <PageHeader title="RiskFlow" description={t(locale, "landing.description")} />
        <div className="space-y-3 rounded-lg border bg-card p-6">
          <StatusBadge status={signedIn ? "open" : "draft"} />
          <p className="text-sm text-muted-foreground">{t(locale, "auth.identityNote")}</p>
          {signedIn ? (
            <a className={buttonVariants()} href="/tenants">
              {t(locale, "auth.chooseOrg")}
            </a>
          ) : (
            <a className={buttonVariants()} href="/login" data-testid="landing-login">
              {t(locale, "auth.login")}
            </a>
          )}
        </div>
      </main>
    </PublicChrome>
  );
}
