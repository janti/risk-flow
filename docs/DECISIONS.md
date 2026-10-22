# Päätökset

## ADR 0001 — Modulaarinen monolitti

Yksi deployattava web-sovellus ja worker. Domain-rajat paketeilla, ei mikropalveluilla. Perustelu: 12 sprintin MVP, yksi tietokanta, RLS-eristys.

## ADR 0002 — pnpm ja Turborepo

Työtilat ja välimuistetut `typecheck`/`lint`/`test`-putket. Node 22+.

## ADR 0003 — Ei valeautentikaatiota

Valekirjautumista, mock-sessioita tai ohitus-tokeneita ei toteuteta. Auth.js + oikea OIDC (paikallisesti `oidc-provider`, muualla ulkoinen IdP). Identiteetti ≠ tenant-pääsy. Toteutettu Sprint 03:ssa.

## ADR 0004 — PostgreSQL RLS ja SET LOCAL

Tenant-eristys tietokannassa, ei vain sovelluksessa. Konteksti transaktiokohtaisesti pooled-yhteyksissä (`SELECT set_config('app.tenant_id', uuid, true)` = SET LOCAL). Ajonaikaiset roolit `riskflow_app` ja `riskflow_worker` ilman `BYPASSRLS`-oikeutta. Toteutettu Sprint 02:ssa.

## ADR 0005 — Versionoitavat mallit, ei visuaalisia builereita

Lomakkeet, pisteytys ja työnkulut versionoidaan. Visual workflow/dashboard builderit on rajattu MVP:n ulkopuolelle.

## ADR 0006 — Jaettu design system paketissa `@riskflow/ui`

shadcn/ui ja Radix elävät `packages/ui`:ssa. Web-sovellus ei kopioi primitiivejä.

## ADR 0007 — Suomenkielinen dokumentaatio, englanninkielinen koodi

Käyttöliittymän proto-tekstit ovat suomeksi. Tunnisteet, API ja skeema englanniksi.

## ADR 0008 — Ei Dockeria paikallisessa kehityksessä

Docker Desktop vaatii kirjautumisen ja on maksullinen osalle organisaatioista. Paikallinen PostgreSQL ajetaan `embedded-postgres`-paketilla (oikeat PostgreSQL 16 -binäärit, MIT). Redis ajetaan natiivina prosessina (`redis-server` tai avoimen lähdekoodin Windows-binääri). Tietokanta pysyy PostgreSQL 16+:na; RLS-suunnitelma ei muutu.

## ADR 0009 — Paikallinen OIDC ilman Dockeria

Sprint 03 käyttää Auth.js-kirjastoa ja oikeaa OIDC Authorization Code + PKCE -virtaa. Paikallinen IdP on `oidc-provider` (Node), ei mock-sessio. Tuotannossa `AUTH_ISSUER` osoittaa organisaation IdP:hen.

## ADR 0011 — Paikallinen objektisäilö ilman Dockeria

Sprint 10 käyttää S3-yhteensopivaa avainmallia (`tenants/{tenantId}/...`) ja HMAC-allekirjoitettuja URL:ia. Paikallinen adapteri kirjoittaa `.local/object-storage` -hakemistoon, jotta MinIO/Docker ei ole pakollinen. `S3_*`-ympäristömuuttujat on varattu myöhempään oikeaan S3-taustaan.

## ADR 0012 — Monitorointi ilman Sentry/OTel MVP:ssä

Sprint 12:n seuranta on liveness (`/health`), readiness (`/ready`), prosessilokit ja `Server-Timing`. Sentry ja OpenTelemetry jäävät myöhemmäksi, jotta MVP ei sido kolmannen osapuolen APM-sopimukseen. Hälytykset kytketään käänteisproxyyn ja `/ready` 503 -vastauksiin.

## ADR 0010 — Suora käyttäjälisäys ilman sähköpostia

Tenant-admin (`users:manage`) voi luoda jäsenyyden heti (`POST .../memberships`, `mode: "direct"`). Kutsulinkki säilyy rinnalla. Pending-käyttäjän `auth_subject` on `pending-email|<email>` kunnes OIDC-kirjautuminen lunastaa sen. Sähköpostia ei lähetetä Sprint 04:ssä.
