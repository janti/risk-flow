import { authorize, listTenantMemberships } from "@riskflow/auth";
import { t } from "@riskflow/shared";
import { PageHeader, StatusBadge } from "@riskflow/ui";
import { AccessDenied } from "../../../../../../components/access-denied";
import { MemberAddDialog } from "../../../../../../components/member-add-dialog";
import { MemberInviteDialog } from "../../../../../../components/member-invite-dialog";
import { getCurrentTenantAccess } from "../../../../../../lib/current-access";
import { getAppDatabase } from "../../../../../../lib/db";
import { resolveRequestLocale } from "../../../../../../lib/locale";

export default async function UsersSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const access = await getCurrentTenantAccess(tenantSlug);
  if (!access || !authorize(access, "users:manage")) {
    return <AccessDenied />;
  }
  const locale = await resolveRequestLocale();

  const members = await listTenantMemberships(getAppDatabase(), access);
  if (members === "forbidden") {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t(locale, "users.title")} description={t(locale, "users.description")} />
      <div className="flex flex-wrap gap-2">
        <MemberAddDialog tenantSlug={tenantSlug} />
        <MemberInviteDialog tenantSlug={tenantSlug} />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{t(locale, "users.tableCaption")}</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="px-4 py-2">{t(locale, "common.name")}</th>
            <th scope="col" className="px-4 py-2">{t(locale, "common.email")}</th>
            <th scope="col" className="px-4 py-2">{t(locale, "common.roles")}</th>
            <th scope="col" className="px-4 py-2">{t(locale, "common.status")}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-b">
              <th scope="row" className="px-4 py-2 font-medium">{member.displayName}</th>
              <td className="px-4 py-2">{member.email}</td>
              <td className="px-4 py-2">{member.roleKeys.join(", ")}</td>
              <td className="px-4 py-2" data-testid={`member-status-${member.email}`}>
                {member.pending ? t(locale, "status.pendingLogin") : <StatusBadge status={member.status} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
