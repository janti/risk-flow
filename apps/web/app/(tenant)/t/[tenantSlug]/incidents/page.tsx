import { hasEnabledModule } from "@riskflow/auth";
import { t } from "@riskflow/shared";
import { EmptyState, PageHeader } from "@riskflow/ui";
import { AccessDenied } from "../../../../../components/access-denied";
import { getCurrentTenantAccess } from "../../../../../lib/current-access";
import { resolveRequestLocale } from "../../../../../lib/locale";

export const dynamic = "force-dynamic";

export default async function IncidentsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const access = await getCurrentTenantAccess(tenantSlug);
  if (!access || !hasEnabledModule(access, "incidents")) {
    return <AccessDenied />;
  }
  const locale = await resolveRequestLocale();

  return (
    <div className="space-y-6" data-testid="incidents-page">
      <PageHeader title={t(locale, "incidents.title")} description={t(locale, "incidents.description")} />
      <EmptyState title={t(locale, "incidents.emptyTitle")} description={t(locale, "incidents.emptyDescription")} />
    </div>
  );
}
