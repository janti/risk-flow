import { buttonVariants, PageHeader } from "@riskflow/ui";
import { t } from "@riskflow/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PublicChrome } from "../../components/public-chrome";
import { auth, signIn } from "../../auth";
import { resolveRequestLocale } from "../../lib/locale";
import { isLoginRateLimited } from "../../lib/rate-limit";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  if (session?.user?.authSubject) {
    redirect(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/tenants");
  }
  const locale = await resolveRequestLocale();

  return (
    <PublicChrome>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 p-6">
        <PageHeader title={t(locale, "auth.loginTitle")} description={t(locale, "auth.loginDescription")} />
        {error === "rate_limited" ? (
          <p className="text-destructive text-sm" role="alert">
            {t(locale, "error.rate_limited")}
          </p>
        ) : null}
        <form
          action={async () => {
            "use server";
            const requestHeaders = await headers();
            if (isLoginRateLimited(requestHeaders)) {
              redirect("/login?error=rate_limited");
            }
            await signIn("oidc", {
              redirectTo: callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/tenants",
            });
          }}
        >
          <button className={buttonVariants()} type="submit" data-testid="login-oidc">
            {t(locale, "auth.loginOidc")}
          </button>
        </form>
      </main>
    </PublicChrome>
  );
}
