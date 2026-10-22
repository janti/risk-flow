# Saavutettavuus (Sprint 11)

Tavoite: **WCAG 2.2 AA** työntekijä-, esimies- ja ylläpitäjäpoluilla. Uusia moduuleja ei lisätty.

## Korjaukset

- Skip-linkki siirtää fokuksen `#main-content`-elementtiin (`tabindex="-1"`).
- Mobiilivalikko: `aria-expanded`, Esc sulkee, fokus palaa avauspainikkeeseen (Radix Sheet).
- Lomakkeen luonti käyttää Sheet-dialogia (fokusansa, Esc), ei räätälöityä overlayta.
- Taulukot: `caption`, `scope`, vaakavieritys. Riskilista on korteilla alle `md`-katkaisun.
- Matriisisolut: `aria-label` ja `aria-pressed`.
- Virhetila: `role="alert"` ja `aria-live="assertive"`.
- Ilmoituskello: `aria-haspopup` / `aria-expanded`.
- Globaali riskihaku (`/`) on combobox + listbox.
- `prefers-reduced-motion` sammuttaa animaatiot.
- `muted-foreground` tummennettu kontrastin vuoksi.
- `html lang` seuraa käyttäjän kieltä.

## Testatut polut

| Rooli | Polku | Mobiili |
|---|---|---|
| Employee | koti → omat toimenpiteet | kyllä |
| Admin | skip-linkki, riskilista, haku `/` | kyllä (kortit) |
| Admin | audit, ilmoitukset, lomakkeen luonti | osin |

Playwright: `tests/e2e/accessibility.spec.ts`, `tests/e2e/app-shell.spec.ts`.

## Ei-kriittiset avoimet asiat

- Automaattista axe-skannausta ei ole CI:ssä; manuaalinen ja Playwright-tarkistus.
- Lomake-editorin raahaus vaatii näppäimistön (`@dnd-kit` KeyboardSensor), mutta kosketusruudun kohteet ovat tiheitä.
- PDF-yhteenveto on ASCII-Helvetica; ruudunlukija ei lue ladattua PDF:ää.
- Oikean S3:n ja ClamAV:n saavutettavuus ei kuulu tähän sprinttiin.
