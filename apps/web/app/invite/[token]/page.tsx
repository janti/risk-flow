import { acceptInvitation } from "@riskflow/auth";
import { t } from "@riskflow/shared";
import { buttonVariants, PageHeader } from "@riskflow/ui";
import { redirect } from "next/navigation";
import { PublicChrome } from "../../../components/public-chrome";
import { getCurrentUser } from "../../../lib/current-access";
import { getAppDatabase } from "../../../lib/db";
import { resolveRequestLocale } from "../../../lib/locale";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=/invite/${token}`);
  }
  const locale = await resolveRequestLocale();

  async function accept(formData: FormData) {
    "use server";
    const inviteToken = String(formData.get("token") ?? "");
    const current = await getCurrentUser();
    if (!current) {
      redirect(`/login?callbackUrl=/invite/${inviteToken}`);
    }
    const result = await acceptInvitation(getAppDatabase(), current, inviteToken);
    if (result !== "accepted") {
      redirect("/invite/invalid");
    }
    redirect("/tenants");
  }

  return (
    <PublicChrome>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 p-6">
        <PageHeader
          title={t(locale, "auth.acceptInviteTitle")}
          description={t(locale, "auth.acceptInviteDescription", { email: user.email })}
        />
        <form action={accept}>
          <input type="hidden" name="token" value={token} />
          <button className={buttonVariants()} type="submit" data-testid="accept-invite">
            {t(locale, "auth.acceptInvite")}
          </button>
        </form>
      </main>
    </PublicChrome>
  );
}
