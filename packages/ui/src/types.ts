import type { ComponentType, ReactNode } from "react";

export type NavigationItem = {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  section?: string;
};

export type BreadcrumbItem = {
  href?: string;
  label: string;
};

export type TenantOption = {
  slug: string;
  name: string;
};

export type AppShellProps = {
  tenantSlug: string;
  brandName?: string;
  navigation: NavigationItem[];
  breadcrumbs?: BreadcrumbItem[];
  currentPath?: string;
  tenants?: TenantOption[];
  accountMenu?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
};
