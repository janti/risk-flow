import {
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardList,
  FileStack,
  Home,
  ListChecks,
  Puzzle,
  ScrollText,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { PermissionKey } from "@riskflow/permissions";
import type { AppLocale } from "@riskflow/shared";
import { t } from "@riskflow/shared";
import type { NavigationItem } from "@riskflow/ui";

type TenantNavItem = NavigationItem & { permission?: PermissionKey; moduleKey?: string };

export function tenantNavigation(tenantSlug: string, locale: AppLocale): TenantNavItem[] {
  const base = `/t/${tenantSlug}`;

  return [
    { href: `${base}/home`, label: t(locale, "nav.home"), icon: Home },
    {
      href: `${base}/risks`,
      label: t(locale, "nav.risks"),
      icon: ShieldAlert,
      permission: "risk:read",
      moduleKey: "risk-register",
    },
    {
      href: `${base}/actions`,
      label: t(locale, "nav.actions"),
      icon: ListChecks,
      permission: "risk:read",
      moduleKey: "risk-register",
    },
    {
      href: `${base}/analytics`,
      label: t(locale, "nav.analytics"),
      icon: BarChart3,
      permission: "analytics:read",
      moduleKey: "risk-register",
    },
    { href: `${base}/incidents`, label: t(locale, "nav.incidents"), icon: AlertTriangle, moduleKey: "incidents" },
    {
      href: `${base}/settings/organization`,
      label: t(locale, "nav.organization"),
      icon: Building2,
      section: "settings",
      permission: "users:manage",
    },
    {
      href: `${base}/settings/users`,
      label: t(locale, "nav.users"),
      icon: Users,
      section: "settings",
      permission: "users:manage",
    },
    {
      href: `${base}/settings/roles`,
      label: t(locale, "nav.roles"),
      icon: ClipboardList,
      section: "settings",
      permission: "users:manage",
    },
    {
      href: `${base}/settings/forms`,
      label: t(locale, "nav.forms"),
      icon: FileStack,
      section: "settings",
      permission: "form:manage",
      moduleKey: "risk-register",
    },
    {
      href: `${base}/settings/modules`,
      label: t(locale, "nav.modules"),
      icon: Puzzle,
      section: "settings",
      permission: "module:manage",
    },
    {
      href: `${base}/settings/audit`,
      label: t(locale, "nav.audit"),
      icon: ScrollText,
      section: "settings",
      permission: "audit:read",
    },
  ];
}
