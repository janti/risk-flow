import { buttonVariants } from "@riskflow/ui";
import { t } from "@riskflow/shared";
import { signOut } from "../auth";
import { resolveRequestLocale } from "../lib/locale";

export async function LogoutButton() {
  const locale = await resolveRequestLocale();
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button className={buttonVariants({ variant: "ghost", size: "sm" })} type="submit" data-testid="logout">
        {t(locale, "auth.logout")}
      </button>
    </form>
  );
}
