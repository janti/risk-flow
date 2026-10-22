# Design system

Jaettu UI elää paketissa `@riskflow/ui`. Sovellus tuo komponentit sieltä; Tailwind-teema ja CSS-muuttujat ovat samassa paketissa.

## Periaatteet

- Semanttinen typografia: `h1`–`h3`, muted-kuvaukset, `PageHeader`
- Vaalea ja tumma teema (`next-themes`, class-strategia)
- Tyhjä, lataus- ja virhetila jokaisessa näkymässä
- Näppäimistö: näkyvä fokus, skip-linkki (`#main-content`), Esc sulkee mobiilisivupalkin, fokus palaa avauspainikkeeseen
- Taulukot: caption + `scope`, mobiilissa korttilista kun sarakkeita on paljon
- Haku: globaali combobox (`/`-pikanäppäin)
- Labelit, `aria-expanded` / `aria-controls` mobiilivalikossa
- Tenant-vaihtaja listaa vain todennetut jäsenyydet

## Sprint 01 -komponentit

`Button`, `Badge`, `Skeleton`, `Separator`, `Sheet`, `AppShell`, `SideNavigation`, `TenantSwitcher`, `Breadcrumbs`, `PageHeader`, `EmptyState`, `ErrorState`, `StatusBadge`, `ThemeToggle`, `PrototypeBanner`, `PermissionGate`.

## Teema

Värit ovat CSS-muuttujia (`--background`, `--primary`, `--risk-low` … `--risk-critical`). Sprint 05 käyttää luokitusvärejä matriisissa ja arviointien `StatusBadge`-näytössä.

## Myöhemmät komponentit

Riski: `RiskTable`, `RiskFilterBar`, `RiskForm`, `RiskAssessmentPanel`, `RiskMatrix`, `RiskTreatmentPanel`, `RiskActionList` (Sprint 04–06), `RiskFormRenderer` (Sprint 08). Myöhemmin: `RiskHistory`.

Toimenpiteet: `ActionsBoard` (omat tehtävät ja lista).

Hallinta: `MemberInviteDialog`, `MemberAddDialog`, `OrganizationTree`, `RolePermissionMatrix`, `ModuleToggleList`. Lomakkeet: `FormList`, `FormEditor` (kenttäpaletti, raahausjärjestys, ominaisuuspaneeli, ehdolliset säännöt, esikatselu, julkaisu).

Analytiikka: `KpiCard`, `AnalyticsBoard` (KPI, heatmap, kategoriat, trendit, myöhässä olevat), `EmployeeHome`, `DashboardFilterBar`.

Näitä ei toteuteta Sprint 01:ssä.
