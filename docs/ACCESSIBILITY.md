# Accessibility (Sprint 11)

Target: **WCAG 2.2 AA** on employee, manager, and admin journeys. No new modules were added.

## Fixes

- Skip link moves focus to `#main-content` (`tabindex="-1"`).
- Mobile menu: `aria-expanded`, Esc closes, focus returns to the opener (Radix Sheet).
- Form create uses a Sheet dialog (focus trap, Esc), not a custom overlay.
- Tables: `caption`, `scope`, horizontal scroll. The risk list is cards below the `md` breakpoint.
- Matrix cells: `aria-label` and `aria-pressed`.
- Error state: `role="alert"` and `aria-live="assertive"`.
- Notification bell: `aria-haspopup` / `aria-expanded`.
- Global risk search (`/`) is combobox + listbox.
- `prefers-reduced-motion` disables animations.
- `muted-foreground` darkened for contrast.
- `html lang` follows the user language.

## Tested paths

| Role | Path | Mobile |
|---|---|---|
| Employee | home → own actions | yes |
| Admin | skip link, risk list, search `/` | yes (cards) |
| Admin | audit, notifications, form create | partial |

Playwright: `tests/e2e/accessibility.spec.ts`, `tests/e2e/app-shell.spec.ts`.

## Non-critical open items

- No automated axe scan in CI; manual and Playwright checks.
- The form editor drag-and-drop supports keyboard (`@dnd-kit` KeyboardSensor), but touch targets are dense.
- PDF summary is ASCII Helvetica; a screen reader does not read the downloaded PDF.
- Accessibility of real S3 and ClamAV is out of this sprint.
