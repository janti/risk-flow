# Design system

Shared UI lives in `@riskflow/ui`. The app imports components from there; the Tailwind theme and CSS variables are in the same package.

## Principles

- Semantic typography: `h1`–`h3`, muted descriptions, `PageHeader`
- Light and dark theme (`next-themes`, class strategy)
- Empty, loading, and error states in every view
- Keyboard: visible focus, skip link (`#main-content`), Esc closes the mobile sidebar, focus returns to the opener
- Tables: caption + `scope`; card list on mobile when there are many columns
- Search: global combobox (`/` shortcut)
- Labels, `aria-expanded` / `aria-controls` on the mobile menu
- Tenant switcher lists only verified memberships

## Sprint 01 components

`Button`, `Badge`, `Skeleton`, `Separator`, `Sheet`, `AppShell`, `SideNavigation`, `TenantSwitcher`, `Breadcrumbs`, `PageHeader`, `EmptyState`, `ErrorState`, `StatusBadge`, `ThemeToggle`, `PrototypeBanner`, `PermissionGate`.

## Theme

Colors are CSS variables (`--background`, `--primary`, `--risk-low` … `--risk-critical`). Sprint 05 uses rating colors in the matrix and assessment `StatusBadge` display.

## Later components

Risk: `RiskTable`, `RiskFilterBar`, `RiskForm`, `RiskAssessmentPanel`, `RiskMatrix`, `RiskTreatmentPanel`, `RiskActionList` (Sprints 04–06), `RiskFormRenderer` (Sprint 08). Later: `RiskHistory`.

Actions: `ActionsBoard` (own tasks and list).

Admin: `MemberInviteDialog`, `MemberAddDialog`, `OrganizationTree`, `RolePermissionMatrix`, `ModuleToggleList`. Forms: `FormList`, `FormEditor` (field palette, drag order, property pane, conditional rules, preview, publish).

Analytics: `KpiCard`, `AnalyticsBoard` (KPI, heatmap, categories, trends, overdue), `EmployeeHome`, `DashboardFilterBar`.

These were not implemented in Sprint 01.
