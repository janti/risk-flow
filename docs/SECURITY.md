# Turvallisuus

## Voimassa Sprint 01:stä

- Ei valeautentikaatiota, mock-sessioita tai ohitus-tokeneita.
- Salaisuuksia ei commitoita. `.env.example` sisältää tyhjät tai vain-dev-arvot.
- `GET /health` ei paljasta ympäristömuuttujia.
- Domain-paketit eivät riipu Reactista.
- Perustason suojaotsikot: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.
- Sprint 12: `Content-Security-Policy`, tuotannon `Strict-Transport-Security`, `Cross-Origin-Opener-Policy` ja `Cross-Origin-Resource-Policy`.

## Identiteetti ja tenant

Identiteetti ei tarkoita tenant-pääsyä. Tenant päätellään todennetusta jäsenyydestä, slug tarkistetaan jäsenyyttä vasten, ja aktiivinen rooli valtuutetaan. JSON-bodyn tenant-tunnisteeseen ei luoteta. UUID:t ovat opaakkeja; palvelin määrää toimijan ja tenantin.

## Valtuutus

Oikeusavaimet: `risk:read`, `risk:create`, `risk:update`, `risk:archive`, `risk:assess`, `risk:approve`, `action:assign`, `action:complete`, `analytics:read`, `form:manage`, `module:manage`, `users:manage`, `audit:read`.

Tarkistusjärjestys: jäsenyys, oikeus, org-yksikkö, omistajuus, tietueen näkyvyys. Default deny. Alustan ylläpitäjillä ei ole automaattista lukuoikeutta tenant-liiketoimintadataan.

Sprint 06: `risk:approve` ei salli oman käsittelyn hyväksyntää, kun tenantin `settings_json.separationOfDuties` on päällä. Toimenpiteiden näkyvyys seuraa riskin org-yksikkörajausta.

Sprint 07: dashboard-aggregaatit ja CSV-vienti käyttävät samoja jäsenyys-, oikeus- ja org-yksikköpredikaatteja kuin listakyselyt. Kaavioiden summat täsmäytetään valtuutettuihin riveihin testeissä. CSV-solut neutralisoidaan kaavainjektiota vastaan.

Sprint 08: lomakkeiden hallinta vaatii `form:manage`. Ehdolliset säännöt ovat AST, ei suoritettavaa koodia. Julkaistut `form_versions`-rivit ovat muuttumattomia. Toisen tenantin lomake ei näy eikä ole käytettävissä.

Sprint 09: moduulin enablement tarkistetaan palvelu- ja API-kerroksessa, ei vain navigaatiossa. Tenant-admin ei voi myöntää itselleen entitlementtia. Pois kytketty moduuli palauttaa `403 module_disabled` suoralle API-kutsulle.

Sprint 11: saavutettavuus- ja suorituskykykovennus ei muuta valtuutusmallia. `Server-Timing` paljastaa vain keston, ei SQL:ää. Haku käyttää samoja `risk:read`- ja org-yksikköpredikaatteja kuin lista.

Sprint 12: mutaatiot ja kirjautuminen ovat rate-limitattuja (`429 rate_limited`). `GET /ready` tarkistaa PostgreSQL- ja Redis-yhteydet eikä paljasta ympäristömuuttujia. `audit_events`-retention on owner-roolin DBA-skripti; app/worker eivät voi DELETE/UPDATE. Tenant-offboarding merkitsee tenantin `offboarded` ja jäsenyydet `revoked`. Pentest-checklist: `docs/PENTEST.md`. Sertifiointia ei väitetä.

Sprint 10: liiteavaimet ovat palvelimen luomia ja tenant-etuliitteisiä; asiakkaan avaimeen ei luoteta. Lataus- ja upload-URL:t vanhenevat (HMAC, 60 s). Worker käyttää `DATABASE_URL_WORKER`-roolia, SET LOCAL -tenanttia outbox-rivistä ja `moduleIsEnabled`-tarkistusta ennen sivuvaikutuksia. Outbox-käsittely on idempotentti (`dedupeKey` / `processedAt`).

## Tietokanta

Katso `docs/DATABASE.md`. RLS + Prisma-pooling on tunnistettu projektiriski: tenant-konteksti vain `SET LOCAL` transaktiossa, ei session-tasolla.

Sprint 02: tenant-tauluilla on `ENABLE` + `FORCE ROW LEVEL SECURITY`. Ajonaikaiset roolit `riskflow_app` ja `riskflow_worker` ovat `NOSUPERUSER` ja `NOBYPASSRLS`. Reitit käyttävät `createTenantDatabase(...).withTenant(...)`. Raakaa Prisma-asiakasta ei viedä paketista. `audit_events` on append-only (ei UPDATE/DELETE). Muissa ympäristöissä tietokantaroolit luodaan ennen migraatiota omilla salasanoilla.

## API

Sessio-eväste (Auth.js JWT, httpOnly) ja CSRF (same-origin Origin-tarkistus mutaatioille). Virhevastaukset eivät paljasta toisen tenantin tietueiden olemassaoloa: ei-jäsen saa 404, jäsen ilman oikeutta 403, tunnistautumaton 401. Listat käyttävät keyset-sivutusta. `PATCH` vaatii `version`-kentän ja palauttaa 409 rinnakkaisessa muokkauksessa.

Alustan ylläpitäjä ei saa automaattista lukuoikeutta tenant-liiketoimintadataan. Peruttu jäsenyys (`status=revoked`) katkaisee pääsyn heti, koska jäsenyys luetaan kannasta joka pyynnössä eikä JWT:stä.

## Testit

Negatiiviset testit: SELECT/UPDATE/DELETE/INSERT, liitokset, aggregaatit, liitteiden URL:t, jonotyöt ja cross-tenant-viittaukset. IDOR, CSRF, stored XSS, tiedostolataus, CSV-injektio, rate limit ja väärän tenantin välimuistit. Sprint 12: `tests/e2e/security.spec.ts`, `packages/shared/src/rate-limit.test.ts` ja audit-append-only RLS-tapaus.
