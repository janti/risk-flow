# Arkkitehtuuri

RiskFlow on **modulaarinen monolitti**. Yksi Next.js-sovellus palvelee tenant-käyttöliittymän ja `/api/v1`-rajapinnan. Domain-logiikka asuu paketeissa, joilla ei ole React-riippuvuutta. Taustatyöt ajetaan erillisessä worker-prosessissa.

## Nykytila (Sprintit 01–12)

Toteutettu:

- pnpm-workspace ja Turborepo
- `apps/web` Next.js App Routerilla, Tailwindilla ja shadcn/ui-pohjaisella design systemillä
- responsiivinen `AppShell` tenant-reiteille `/t/[tenantSlug]/...`
- `GET /health`
- paikallinen PostgreSQL 16 ja Redis ilman Dockeria (`pnpm services:start`)
- worker (BullMQ): outbox-tyhjennys, myöhässä olevat muistutukset ja liitteiden scan-tila
- CI: typecheck, lint, unit-testit, Playwright
- Prisma-skeema, SQL-migraatiot, FORCE RLS ja tenant-transaktiokääre (`set_config(..., true)`)
- Auth.js + OIDC, jäsenyystarkistus, roolipresetit, kutsut ja suora käyttäjälisäys
- riskirekisterin CRUD, optimistic concurrency, audit-tapahtumat ja org-yksikkörajaus
- versionoidut 3x3/5x5-pisteytysmallit, muuttumattomat inherent/residual-arvioinnit ja valtuutettu heatmap
- käsittelystrategiat, toimenpiteet, hyväksyntävaiheet, tehtävien eriyttäminen ja transaktionaalinen outbox
- roolipohjaiset dashboardit ja valtuutetut aggregaatit (`packages/analytics`): KPI, heatmap, kategoriat, kuukausitrendit, myöhässä olevat toimenpiteet ja scoped CSV-vienti
- dynaamiset lomakkeet (`packages/form-engine`): tenant-kohtaiset määrittelyt, muuttumattomat julkaistut versiot, AST-ehdot ja metadataohjattu renderer
- moduulirekisteri (`packages/module-registry`): katalogi, alustan entitlementit, tenant-kytkimet, riippuvuudet ja API-kerroksen enablement
- organisaatiopuu, roolioikeusmatriisi sekä locale/branding (`packages/auth`)
- WCAG 2.2 AA -kovennus, globaali riskihaku, listaindeksit ja `Server-Timing` (Sprint 11). Mittaukset: `docs/PERFORMANCE.md`, saavutettavuus: `docs/ACCESSIBILITY.md`.
- Kategoriakohtaiset standardiohjeet (ISO 31000/27001/45001, NIST CSF 2.0, työsuojelu) rekisterissä, arvioinnissa ja käsittelyssä. Ei compliance-mapping-moduulia: `docs/STANDARDS.md`.
- Sprint 12: `GET /ready`, mutaatioiden rate limit, CSP/HSTS, varmuuskopio/restore-drill, tenant-vienti/offboarding, incident- ja deploy-runbookit. Monitorointi ilman Sentry/OTel. Go/no-go: `docs/GO_NO_GO.md`.

Ei toteutettu (tietoisesti):

- oikea S3/MinIO, Sentry, OpenTelemetry

## Sovellusrajat

```
apps/web            HTTP, reitit, UI
apps/worker         taustatyöt (BullMQ, outbox, muistutukset)
packages/ui         design system (React)
packages/shared     API-envelopet, slug-validointi
packages/tenant     tenant-sopimus
packages/permissions oikeusavaimet, default deny
packages/database   Prisma, RLS, tenant-transaktio
packages/auth       OIDC-subjektit, jäsenyys, RBAC-auttajat
packages/risk-engine pisteytys, arvioinnit ja riskirekisterin palvelu
packages/form-engine lomakemäärittelyt ja AST
packages/module-registry moduilikatalogi
packages/workflow-engine versionoidut työnkulut (myöhemmin)
packages/analytics  valtuutetut aggregaatit
modules/*           kytkettävien ominaisuuksien paikat (katalogi Sprint 09)
```

`apps/web` omistaa reitit. Domain-paketit eivät importoi Reactia. Raakaa Prisma-asiakasta ei altisteta reittikäsittelijöille.

## Tenant-konteksti

Tenant päätellään todennetusta jäsenyydestä ja tarkistetaan reitin `tenantSlug`-arvoa vasten. JSON-bodyn tenant-tunnisteeseen ei luoteta. `/t/[tenantSlug]` vaatii aktiivisen jäsenyyden. Tietokantakyselyt tenant-dataan kulkevat `withTenant`-kääreen kautta.

Tietokantayhteyksissä (Sprint 02) tenant asetetaan **transaktion sisällä**:

```sql
SET LOCAL app.tenant_id = '<uuid>';
```

Session-tason `SET` on kielletty pooled-yhteyksissä.

## Tietovuo (tavoitetila)

1. Selain kutsuu `/api/v1/tenants/:slug/...` sessiokeksillä.
2. Palvelin varmistaa istunnon, jäsenyyden, oikeuden ja org-yksikkörajoitteen.
3. Palvelukerros avaa tenant-transaktion ja käyttää Prismaa RLS:n alla.
4. Kirjoitukset tuottavat audit- ja outbox-tapahtumat samassa transaktiossa.
5. Worker lukee käsittelemättömän outboxin `app.worker_poll`-kontekstissa, sitten avaa `withTenant` outbox-rivin tenantista (ei käyttäjältä). Moduuli tarkistetaan ennen sivuvaikutuksia. Ilmoitusten `dedupeKey` tekee uudelleenyrityksistä idempotentteja.

## UI-reitit

Käyttöliittymä elää polun `/t/[tenantSlug]` alla: `home`, `risks`, `actions`, `analytics`, `incidents` ja `settings/*`. Auth-reitit: `/login`, `/tenants`, `/invite/[token]`.

## Julkaisuportit

- Prototype (Sprint 01): kuori ja navigaatio, ei autentikointilupauksia
- Sisäinen alpha (Sprintit 1–5): tenant-turvallinen risk CRUD ja arvioinnit
- Feature-complete beta (Sprintit 1–10)
- Pilot-valmis MVP (Sprintit 1–12)
