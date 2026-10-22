# Tietokanta

Sprint 02 toteuttaa Prisma-skeeman, SQL-migraatiot ja RLS:n seuraaville tauluille: `tenants`, `users`, `memberships`, `org_units`, `org_unit_memberships`, `roles`, `permissions`, `role_permissions`, `membership_roles`, `risk_categories`, `risks`, `audit_events`. Paikallinen PostgreSQL 16 käynnistyy ilman Dockeria.

## Yhteiset säännöt

Jokaisella tenant-rajatulla taululla on `tenant_id UUID NOT NULL`, `created_at` ja `updated_at`. Kriittisillä muokattavilla tietueilla on myös `created_by` ja `updated_by`. Tenantin sisäiset viittaukset käyttävät yhdistelmäavaimia, joissa `tenant_id` on mukana. Tietokantarajoitteet ja RLS ovat pakollisia. Globaaliin `users`-tauluun ei tallenneta tenant-sensitiivistä aineistoa.

## Taulut (suunnitelma)

`tenants`, `users`, `memberships`, `org_units`, `org_unit_memberships`, `roles`, `permissions`, `role_permissions`, `membership_roles`, `module_catalog`, `tenant_entitlements`, `tenant_modules`, `risk_categories`, `risks`, `risk_assessments`, `scoring_models`, `risk_treatments`, `actions`, `approvals`, `form_definitions`, `form_versions`, `workflow_definitions`, `workflow_versions`, `workflow_instances`, `dashboard_definitions`, `attachments`, `notifications`, `audit_events`, `outbox_events`.

Tarkat sarakkeet ja rajoitteet ovat tiedostossa `docs/RISKFLOW_CURSOR_IMPLEMENTATION.md`.

## RLS ja yhteysturvallisuus

- Ajonaikainen tietokantarooli ei ole omistaja eikä sisällä `BYPASSRLS`-oikeutta.
- Tenant-tauluille `FORCE ROW LEVEL SECURITY`.
- Tenant-identiteetti: `SET LOCAL app.tenant_id = '<uuid>'` kunkin transaktion sisällä.
- Policy: `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid` sekä `USING` että `WITH CHECK`.
- Kaikki luku ja kirjoitus tenant-transaktiokääreen kautta.
- Migraatioilla ja workerilla erilliset oikeudet. Worker kantaa varmennetun tenant-kontekstin.

## Paikallinen kehitys

```bash
pnpm services:start
```

Komento käynnistää natiivin PostgreSQL 16:n (`embedded-postgres`) ja Rediksen. Windowsilla Redis-binääri ladataan avoimen lähdekoodin julkaisusta; macOS/Linux käyttävät PATH:ssa olevaa `redis-server`-ohjelmaa (`brew install redis` tai `apt install redis-server`).

Yhteysmerkkijonot ovat `.env.example`-tiedostossa:

- `DATABASE_URL` — migraatiot ja seed (omistajarooli)
- `DATABASE_URL_APP` — ajonaikainen `riskflow_app` (ei BYPASSRLS)
- `DATABASE_URL_WORKER` — worker-rooli (ei BYPASSRLS)

```bash
pnpm db:migrate
pnpm db:seed
```

Tunnukset ovat vain paikalliseen kehitykseen. Data säilyy hakemistossa `.local/` (gitignore). Reitit käyttävät `createTenantDatabase(process.env.DATABASE_URL_APP).withTenant(...)` — eivät raakaa Prisma-asiakasta.

## Sprint 02 toteutus

Toteutetut taulut: `tenants`, `users`, `permissions` (globaalit) sekä tenant-rajatut `memberships`, `org_units`, `org_unit_memberships`, `roles`, `role_permissions`, `membership_roles`, `risk_categories`, `risks`, `audit_events`.

Tenant-sisäiset viittaukset käyttävät yhdistelmäavaimia `(tenant_id, id)`. Valinnaiset vanhemmat (`org_units.parent_id`, `risk_categories.parent_id`, `membership_roles.org_unit_id`) on määritelty `MATCH SIMPLE` -avainina, jotta `NULL` on sallittu ilman id-only-viittausta toiseen tenantiin.

RLS-policy:

```sql
tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
```

sekä `USING` että `WITH CHECK`. Tenant-konteksti asetetaan transaktiossa:

```sql
SELECT set_config('app.tenant_id', '<uuid>', true);
```

(`true` = `SET LOCAL`; asetus kuolee transaktion mukana eikä vuoda connection pooliin.)

Migraatio luo paikalliset login-roolit vain jos niitä ei ole. Tuotannossa roolit ja salasanat provisionoidaan ennen `pnpm db:migrate`. Cross-tenant-testit: `packages/database/src/tenant-isolation.test.ts`.

Sprint 03 lisää `users.platform_admin` (ei tenant-pääsyä) ja `invitations` (FORCE RLS, pending-email unique, token-hash). App-rooli saa `INSERT/UPDATE` globaaliin `users`-tauluun JIT-provisionointia varten. `memberships`-taululla on SELECT-policy `app.user_id` -asetukselle (`GET /me`). Kutsun lunastus käyttää `app.invite_token_hash` SELECT-policyä, sen jälkeen `withTenant`.

Sprint 04 käyttää olemassa olevaa `risks`-taulua. Kirjoitukset tapahtuvat `withTenant`-transaktiossa, kasvattavat `version`-kenttää ja lisäävät `audit_events`-rivin samaan transaktioon. Suora käyttäjälisäys luo tarvittaessa käyttäjän `auth_subject`-arvolla `pending-email|<email>`; OIDC-kirjautuminen lunastaa sen vaihtamalla subjektin.

Sprint 05 lisää `scoring_models` ja `risk_assessments` (FORCE RLS, composite FK:t, append-only: ei UPDATE/DELETE). Julkaistu malli on muuttumaton; uusi kynnystaso on uusi `version`. Arviointi tallentaa `scoring_version_id`, lasketun `score`- ja `rating`-arvon.

Sprint 06 lisää `tenants.settings_json` (SoD ja hyväksyntävaiheet), `risk_treatments` (yksi per riski), `actions` (tila + eräpäivä), `approvals` (append-only) ja `outbox_events` (FORCE RLS). Hyväksynnöillä ei ole UPDATE/DELETE-oikeutta.

Sprint 07 ei lisää tauluja. Dashboardit lukevat olemassa olevia riskejä, arviointeja, käsittelyjä ja toimenpiteitä RLS:n alla. Visual dashboard builder ja `dashboard_definitions` jäävät MVP:n ulkopuolelle.

Sprint 08 lisää `form_definitions` (unique tenant+key) ja `form_versions` (unique tenant+definition+version, FORCE RLS). Julkaistut versiot ovat muuttumattomia triggerillä `reject_published_form_version_mutation` (luonnosta saa päivittää). `risks.form_version_id` on valinnainen composite FK (`MATCH SIMPLE`). App-roolilla on SELECT/INSERT/UPDATE, ei DELETE.

Sprint 09 lisää globaalin `module_catalog`-taulun (ei RLS, app vain SELECT) sekä tenant-rajatut `tenant_entitlements` ja `tenant_modules` (FORCE RLS). Entitlementit ovat alustan hallitsemia: app-roolilla on vain SELECT. `tenant_modules` sallii SELECT/INSERT/UPDATE, ei DELETE, jotta poiskytkentä säilyttää rivin. `tenants`-taululle lisätään SELECT kaikille riveille ja UPDATE vain `app.tenant_id`-kontekstissa (locale, timezone, branding `settings_json`-kentässä).

Sprint 10 lisää `attachments` ja `notifications` (FORCE RLS, ei DELETE). `attachments.object_key` on unique tenantissa ja tenant-etuliitteinen. `notifications` unique `(tenant_id, membership_id, dedupe_key)` tekee outbox-uudelleenyrityksestä idempotentin. Worker saa lisä-SELECT-policyn `outbox_events`- ja `actions`-tauluihin, kun `app.worker_poll='true'` — ristiin-tenant poll ilman `BYPASSRLS`. Varsinainen käsittely tapahtuu `withTenant`-transaktiossa outbox-rivin `tenant_id`:llä.

Sprint 11 lisää lista- ja hakemistoindeksit: `risks (tenant_id, created_at, id)`, org-yksikkö/omistaja/kategoria, arviointien tyyppi+aika, sekä `pg_trgm` + `btree_gin` GIN-indeksit `(tenant_id, title)` / `(tenant_id, code)` ILIKE-hakuun. RLS ei muutu.

Sprint 12 ei muuta skeemaa. Varmuuskopio on owner-roolin looginen snapshot (`pnpm ops:backup`) ja restore-drill palauttaa canary-rivin dumpista (`pnpm ops:restore-drill`). Tuotannossa suositellaan native `pg_dump -Fc`, kun `PGBIN` on saatavilla. `audit_events`-purge vaatii triggerin väliaikaisen poiston owner-roolilla (`pnpm ops:audit-retention`). Tenant-offboarding päivittää `tenants.status='offboarded'` ja kumoaa jäsenyydet; rivejä ei poisteta.
