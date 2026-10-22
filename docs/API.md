# API

Kanta: `/api/v1`. Vastausmuoto `{ data, meta }`, virheet `{ error: { code, message, details?, requestId } }`.

Julkinen health-reitti:

`GET /health` → `{ "data": { "status": "ok", "timestamp": "..." }, "meta": {} }` (liveness, ei riippuvuuksia)

`GET /ready` → `{ "data": { "status": "ok", "timestamp": "...", "postgres": true, "redis": true }, "meta": {} }`. Jos PostgreSQL tai Redis ei vastaa: `503 service_unavailable` ilman ympäristömuuttujia.

Sprint 03 toteuttaa identiteetti- ja jäsenyysreitit. Sprint 04 lisää riskirekisterin. Sprint 05 lisää arvioinnit ja heatmapin. Sprint 06 lisää toimenpiteet, käsittelyt ja hyväksynnät. Sprint 07 lisää dashboard-aggregaatit ja scoped CSV-viennin. Sprint 08 lisää dynaamiset lomakkeet. Sprint 09 lisää moduulit, organisaation ja tenant-asetukset. Sprint 10 lisää liitteet, ilmoitukset, PDF-yhteenvedon ja audit-listan. Sopimus on jäädytetty:

| Method | Endpoint | Oikeus |
|---|---|---|
| GET | /me | authenticated |
| GET | /tenants/:slug/context | member |
| GET/POST | /tenants/:slug/risks | risk:read/create |
| GET/PATCH | /tenants/:slug/risks/:id | risk:read/update |
| POST | /tenants/:slug/risks/:id/archive | risk:archive |
| GET/POST | /tenants/:slug/risks/:id/assessments | risk:read/assess |
| GET/POST | /tenants/:slug/risks/:id/actions | risk:read/action:assign |
| PATCH | /tenants/:slug/actions/:id | action:complete or action:assign |
| POST | /tenants/:slug/risks/:id/approvals | risk:approve |
| GET | /tenants/:slug/analytics/overview | analytics:read |
| GET | /tenants/:slug/analytics/heatmap | analytics:read |
| GET/POST | /tenants/:slug/forms | form:manage |
| GET/POST | /tenants/:slug/forms/:id/versions | form:manage |
| POST | /tenants/:slug/forms/:id/versions/:version/publish | form:manage |
| GET/PATCH | /tenants/:slug/modules | module:manage |
| GET/POST | /tenants/:slug/memberships | users:manage |
| GET | /tenants/:slug/audit-events | audit:read |
| POST | /tenants/:slug/attachments/upload-intent | risk:update |
| GET | /tenants/:slug/risks/:id/attachments | risk:read |
| GET | /tenants/:slug/attachments/:id | risk:read |
| GET/PUT | /tenants/:slug/attachments/:id/content | risk:read / risk:update + signed query |
| GET | /tenants/:slug/notifications | member |
| PATCH | /tenants/:slug/notifications/:id | member |
| GET | /tenants/:slug/exports/risks.csv | risk:read |
| GET | /tenants/:slug/exports/risks.pdf | risk:read |

Listakysely: `cursor`, `limit` (oletus 25, max 100), `status`, `categoryId`, `orgUnitId`, `ownerId`, `q`, `sort`. Keyset-sivutus. Tenant-slug tulee reitistä, ei bodysta.

HTTP-koodit: 201 luonnissa, 400/422 virheellisessä syötteessä, 401, 403, 404, 409 rinnakkaisuudessa, 429 rate limit.

## Sprint 04

Toteutetut riskireitit:

- `GET /tenants/:slug/risks` — `risk:read`, suodattimet ja keyset-sivutus (`meta.nextCursor`)
- `POST /tenants/:slug/risks` — `risk:create`, koodi `R-nnn`, 201
- `GET /tenants/:slug/risks/lookups` — kategoriat, yksiköt ja omistajat lomakkeille
- `GET /tenants/:slug/risks/:id` — `risk:read`
- `PATCH /tenants/:slug/risks/:id` — `risk:update`, vaatii `version`, vanhentunut versio → 409
- `POST /tenants/:slug/risks/:id/archive` — `risk:archive`, vaatii `version`

Org-yksikkörajoitteinen jäsen ei näe eikä muuta rajauksen ulkopuolisia riskejä (404). Toisen tenantin tunniste ei vuoda (404).

`POST /tenants/:slug/memberships` hyväksyy `mode: "invite"` (oletus) tai `mode: "direct"`. Suora lisäys luo jäsenyyden ilman kutsutokenia tai sähköpostia. Jos käyttäjää ei ole, syntyy pending-identiteetti, joka lunastetaan ensimmäisellä OIDC-kirjautumisella samalla sähköpostilla.

## Sprint 05

- `GET/POST /tenants/:slug/risks/:id/assessments` — `risk:read` / `risk:assess`. Arvioinnit ovat append-only. Palvelin laskee `score = likelihood * impact` ja `rating` valitun malliversion kynnyksillä.
- `GET /tenants/:slug/risks/matrix` — `risk:read`, heatmap solusuodatusta varten
- `GET /tenants/:slug/analytics/heatmap` — `analytics:read`, samat valtuutetut laskennat
- Riskilista hyväksyy `assessmentType`, `likelihood` ja `impact` (viimeisin arviointi per tyyppi)

Historialliset arvioinnit säilyttävät malliversion, pistemäärän ja luokituksen, vaikka tenant julkaisisi uuden pisteytysmallin.

## Sprint 06

- `GET/POST /tenants/:slug/risks/:id/treatments` — `risk:read` / `risk:update`. Yksi käsittely per riski. Strategiat `avoid|reduce|share|accept`. Hyväksyntä vaatii perustelun.
- `POST /tenants/:slug/risks/:id/approvals` — `risk:approve`. Append-only-päätös. Tenantin `settings_json.separationOfDuties` estää oman lähetyksen hyväksynnän.
- `GET/POST /tenants/:slug/risks/:id/actions` — `risk:read` / `action:assign`
- `GET /tenants/:slug/actions` — `risk:read`, suodattimet `mine`, `overdue`, `status`
- `PATCH /tenants/:slug/actions/:id` — `action:assign` päivitykseen, `action:complete` valmistumiseen

Kirjoitukset tuottavat `audit_events`- ja `outbox_events`-rivit samassa transaktiossa. Worker ei käsittele outboxia tässä sprintissä.

## Sprint 07

- `GET /tenants/:slug/analytics/overview` — `analytics:read`. Valtuutetut KPI:t, heatmap, kategoriat, kuukausitrendit ja myöhässä olevat toimenpiteet. Hakuehdot `from`, `to` (ISO-päivä, oletus 12 kk) ja `assessmentType`.
- `GET /tenants/:slug/analytics/heatmap` — `analytics:read`, nykyinen valtuutettu matriisi ilman aikasuodatusta (Sprint 05).
- `GET /tenants/:slug/exports/risks.csv` — `risk:read`, sama org-yksikkö- ja suodatuslogiikka kuin riskilistalla. Kaavat (`=`, `+`, `-`, `@`) neutralisoidaan.
- Riskilista hyväksyy `createdFrom` ja `createdTo` dashboardin porautumiseen.

Aggregaatit käyttävät samaa `visibleOrgUnitFilter`-predikaattia kuin listakyselyt. Visual dashboard builder ei kuulu MVP:hen.

## Sprint 08

- `GET/POST /tenants/:slug/forms` — `form:manage`. Määrittelyt, uniikki `key` tenantissa.
- `GET /tenants/:slug/forms/:id` — `form:manage`. Yksi määrittely versioineen.
- `GET/POST /tenants/:slug/forms/:id/versions` — `form:manage`. Listaus ja luonnoksen get-or-create. Yksi luonnos kerrallaan; jos luonnos on jo, POST palauttaa sen.
- `GET/PATCH /tenants/:slug/forms/:id/versions/:version` — `form:manage`. Luonnoksen tallennus ja migraatiovaikutuksen esikatselu. Julkaistua versiota ei voi PATCH:ata (409).
- `POST /tenants/:slug/forms/:id/versions/:version/publish` — `form:manage`. Validointi ja julkaisu. Julkaistu rivi on muuttumaton.

Ehdolliset säännöt ovat AST-ilmauksia (`equals`, `in`, `greaterThan`, `and`, `or`, `not`). Suoritettavat skriptit hylätään. Julkaistu skeema tulee täyttäjille `GET /tenants/:slug/risks/lookups` -vastauksen `publishedForm`-kentässä (`risk:read`), jotta risk-manager voi täyttää kentät ilman `form:manage`-oikeutta. Uusi riski sidotaan sillä hetkellä julkaistuun versioon (`form_version_id`). Päivitys ei vaihda versiota; historialliset tietueet renderöidään alkuperäisellä skeemalla.

Toisen tenantin lomaketunniste ei vuoda (404). Työntekijällä ei ole `form:manage`-oikeutta (403).

## Sprint 09

- `GET/PATCH /tenants/:slug/modules` — `module:manage`. Katalogi, entitlementit ja kytkimet. Enable vaatii entitlementin ja riippuvuudet. Disable estetään, jos riippuva moduuli on päällä. Poiskytkentä ei poista tietueita.
- `GET /tenants/:slug/incidents` — `risk:read` ja päällä oleva `incidents`-moduuli. Stub-lista. Pois kytkettynä `403 module_disabled`.
- `GET/POST/PATCH /tenants/:slug/org-units` — `users:manage`. Organisaatiopuu. Sykli → 409.
- `GET/PATCH /tenants/:slug/roles` — `users:manage`. Roolien oikeusmatriisi. Tenant-adminilta ei voi poistaa `users:manage` / `module:manage`.
- `GET/PATCH /tenants/:slug/settings` — `users:manage`. Locale, aikavyöhyke ja branding. SoD-asetuksia ei ylikirjoiteta.
- `GET /tenants/:slug/context` palauttaa vain **päällä olevat** moduuliavaimet.

Pois kytketty `risk-register` palauttaa `403 module_disabled` riski-, lomake- ja analytiikkareiteillä, ei vain navigaatiossa. Entitlementteja ei voi kirjoittaa tenant-adminina.

## Sprint 10

- `POST /tenants/:slug/attachments/upload-intent` — `risk:update`. Palvelin luo tenant-etuliitteisen avaimen ja 60 s voimassa olevan PUT-osoitteen. MIME-allowlist ja max 10 Mt. `.exe` hylätään.
- `PUT /tenants/:slug/attachments/:id/content?exp=&sig=` — istunto + HMAC. Väärä tenant-avain tai vanhentunut allekirjoitus → 403/404. Tallennus kirjoittaa `attachment.uploaded`-outbox-rivin.
- `GET /tenants/:slug/attachments/:id` — allekirjoitettu latausosoite. `pending_scan` → 409, `infected` → 403.
- `GET /tenants/:slug/attachments/:id/content?exp=&sig=` — tiedostosisältö.
- `GET /tenants/:slug/risks/:id/attachments` — `risk:read`, org-yksikkörajaus.
- `GET /tenants/:slug/notifications` — jäsenen inbox, `unreadCount`, keyset-sivutus.
- `PATCH /tenants/:slug/notifications/:id` — merkitse luetuksi. Toisen jäsenen rivi → 404.
- `GET /tenants/:slug/audit-events` — `audit:read`, muuttumaton lista, `meta.nextCursor`.
- `GET /tenants/:slug/exports/risks.pdf` — sama rajaus kuin CSV.

Worker (`DATABASE_URL_WORKER`) tyhjentää outboxin ja lähettää myöhässä-muistutukset. `dedupeKey` estää kaksoiskappaleet uudelleenyrityksessä. Pois kytketty moduuli merkitsee tapahtuman käsitellyksi ilman sivuvaikutuksia.

## Sprint 11

`GET /tenants/:slug/risks` ja `GET /tenants/:slug/analytics/overview` palauttavat `Server-Timing`-otsikon ja `meta.durationMs`. Haku `q` käyttää samoja oikeuksia kuin lista. Uusia endpointteja ei lisätty.

## Sprint 12

Mutaatiot (`POST`/`PUT`/`PATCH`/`DELETE`) `/api/v1`:ssä palauttavat `429 rate_limited` ja `Retry-After`, kun IP-kohtainen raja ylittyy. Kirjautumistoiminto käyttää erillistä rajaa. Uusia liiketoimintaendpointteja ei lisätty.
