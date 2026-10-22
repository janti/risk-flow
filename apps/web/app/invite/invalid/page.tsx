import { ErrorState } from "@riskflow/ui";
import { t } from "@riskflow/shared";
import { PublicChrome } from "../../../components/public-chrome";
import { resolveRequestLocale } from "../../../lib/locale";

export default async function InvalidInvitePage() {
  const locale = await resolveRequestLocale();
  return (
    <PublicChrome>
      <main className="mx-auto flex min-h-screen max-w-lg items-center p-6">
        <ErrorState
          title={t(locale, "auth.invalidInviteTitle")}
          description={t(locale, "auth.invalidInviteDescription")}
          action={
            <a className="text-sm font-medium text-primary underline" href="/tenants">
              {t(locale, "auth.organizations")}
            </a>
          }
        />
      </main>
    </PublicChrome>
  );
}
