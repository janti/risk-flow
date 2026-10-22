import { ErrorState } from "@riskflow/ui";
import { t } from "@riskflow/shared";
import { PublicChrome } from "../components/public-chrome";
import { resolveRequestLocale } from "../lib/locale";

export default async function NotFound() {
  const locale = await resolveRequestLocale();
  return (
    <PublicChrome>
      <main className="mx-auto flex min-h-screen max-w-xl items-center p-6">
        <ErrorState
          title={t(locale, "notFound.title")}
          description={t(locale, "notFound.description")}
          action={
            <a className="text-sm font-medium text-primary underline" href="/">
              {t(locale, "notFound.home")}
            </a>
          }
        />
      </main>
    </PublicChrome>
  );
}
